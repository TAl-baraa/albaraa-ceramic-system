from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import func, or_, select
from sqlalchemy.dialects.postgresql import insert as postgresql_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.core.errors import (
    CashSaleUnpaidError,
    ConflictingInvoiceItemPriceError,
    CustomerNotFoundError,
    InvalidDateRangeError,
    InvalidInvoiceDiscountError,
    InvalidInvoicePricePrecisionError,
    InvalidPieceQuantityError,
    InvoiceNumberGenerationError,
    InvoiceLifecycleIntegrityError,
    InvoiceLinkedTransactionConflictError,
    InvoiceCompletionStockError,
    InvoiceMalformedError,
    InvoiceMissingProductsError,
    InvoiceProductUnitChangedError,
    InvoiceStockExceededError,
    ProductNotFoundError,
    SaleInvoiceAlreadyCompletedError,
    SaleInvoiceNotCompletedError,
    SaleInvoiceNotDraftError,
    SaleInvoiceNotFoundError,
    SaleInvoicePersistenceError,
)
from app.models.customer import Customer
from app.models.customer_transaction import CustomerTransaction
from app.models.product import Product
from app.models.sale_invoice import InvoiceSequence, SaleInvoice
from app.models.sale_invoice_item import SaleInvoiceItem
from app.models.stock_movement import StockMovement
from app.schemas.sale_invoice import (
    SaleInvoiceDraftCreate,
    SaleInvoiceDraftUpdate,
    SaleInvoiceItemCreate,
)
from app.services import customer_transaction_service, inventory_service

AMOUNT_QUANTUM = Decimal("0.000001")


@dataclass(frozen=True)
class PreparedItem:
    product: Product
    quantity: Decimal
    unit_price: Decimal
    total: Decimal


@dataclass(frozen=True)
class PreparedDraft:
    customer_id: int | None
    customer_name_snapshot: str
    currency: str
    note: str
    discount: Decimal
    paid_amount: Decimal
    subtotal: Decimal
    total: Decimal
    remaining_amount: Decimal
    items: list[PreparedItem]


@dataclass(frozen=True)
class InvoicePage:
    items: list[tuple[SaleInvoice, int]]
    total: int


def _money(value: Decimal) -> Decimal:
    return value.quantize(AMOUNT_QUANTUM)


def _next_invoice_number(db: Session, year: int) -> str:
    dialect = db.get_bind().dialect.name
    if dialect == "postgresql":
        statement = (
            postgresql_insert(InvoiceSequence)
            .values(year=year, last_value=1)
            .on_conflict_do_update(
                index_elements=[InvoiceSequence.year],
                set_={"last_value": InvoiceSequence.last_value + 1},
            )
            .returning(InvoiceSequence.last_value)
        )
        sequence = db.scalar(statement)
    elif dialect == "sqlite":
        statement = (
            sqlite_insert(InvoiceSequence)
            .values(year=year, last_value=1)
            .on_conflict_do_update(
                index_elements=[InvoiceSequence.year],
                set_={"last_value": InvoiceSequence.last_value + 1},
            )
            .returning(InvoiceSequence.last_value)
        )
        sequence = db.scalar(statement)
    else:
        row = db.scalar(
            select(InvoiceSequence)
            .where(InvoiceSequence.year == year)
            .with_for_update()
        )
        if row is None:
            row = InvoiceSequence(year=year, last_value=1)
            db.add(row)
            db.flush()
        else:
            row.last_value += 1
        sequence = row.last_value
    if sequence is None:
        raise InvoiceNumberGenerationError()
    return f"INV-{year}-{sequence:04d}"


def _validate_price(currency: str, price: Decimal) -> None:
    if currency == "IQD" and price != price.to_integral_value():
        raise InvalidInvoicePricePrecisionError(currency)
    if currency == "USD" and price.as_tuple().exponent < -2:
        raise InvalidInvoicePricePrecisionError(currency)


def _prepare_items(
    db: Session, currency: str, item_inputs: list[SaleInvoiceItemCreate]
) -> list[PreparedItem]:
    merged: dict[int, tuple[Decimal, Decimal]] = {}
    order: list[int] = []
    for item in item_inputs:
        existing = merged.get(item.product_id)
        if existing is None:
            merged[item.product_id] = (item.quantity, item.unit_price)
            order.append(item.product_id)
        else:
            if existing[1] != item.unit_price:
                raise ConflictingInvoiceItemPriceError(item.product_id)
            merged[item.product_id] = (existing[0] + item.quantity, existing[1])

    products = {
        product.id: product
        for product in db.scalars(select(Product).where(Product.id.in_(order))).all()
    }
    prepared: list[PreparedItem] = []
    for product_id in order:
        product = products.get(product_id)
        if product is None:
            raise ProductNotFoundError()
        quantity, unit_price = merged[product_id]
        if product.unit == "قطعة" and quantity != quantity.to_integral_value():
            raise InvalidPieceQuantityError()
        if quantity > product.quantity:
            raise InvoiceStockExceededError(
                product_id=product.id,
                code=product.code,
                name=product.name,
                requested=quantity,
                available=product.quantity,
                unit=product.unit,
            )
        _validate_price(currency, unit_price)
        quantity = _money(quantity)
        unit_price = _money(unit_price)
        prepared.append(
            PreparedItem(product, quantity, unit_price, _money(quantity * unit_price))
        )
    return prepared


def _prepare_draft(
    db: Session,
    *,
    customer_id: int | None,
    currency: str,
    note: str,
    discount: Decimal,
    paid_amount: Decimal,
    item_inputs: list[SaleInvoiceItemCreate],
) -> PreparedDraft:
    if customer_id is None:
        customer_name = "بيع نقدي"
    else:
        customer = db.get(Customer, customer_id)
        if customer is None:
            raise CustomerNotFoundError()
        customer_name = customer.name
    items = _prepare_items(db, currency, item_inputs)
    subtotal = _money(sum((item.total for item in items), start=Decimal("0")))
    discount = _money(discount)
    paid_amount = _money(paid_amount)
    if discount > subtotal:
        raise InvalidInvoiceDiscountError()
    total = _money(subtotal - discount)
    return PreparedDraft(
        customer_id=customer_id,
        customer_name_snapshot=customer_name,
        currency=currency,
        note=note.strip(),
        discount=discount,
        paid_amount=paid_amount,
        subtotal=subtotal,
        total=total,
        remaining_amount=_money(total - paid_amount),
        items=items,
    )


def _apply_prepared(invoice: SaleInvoice, prepared: PreparedDraft) -> None:
    invoice.customer_id = prepared.customer_id
    invoice.customer_name_snapshot = prepared.customer_name_snapshot
    invoice.currency = prepared.currency
    invoice.note = prepared.note
    invoice.subtotal = prepared.subtotal
    invoice.discount = prepared.discount
    invoice.total = prepared.total
    invoice.paid_amount = prepared.paid_amount
    invoice.remaining_amount = prepared.remaining_amount
    invoice.items = [
        SaleInvoiceItem(
            product_id=item.product.id,
            product_code_snapshot=item.product.code,
            product_name_snapshot=item.product.name,
            unit=item.product.unit,
            quantity=item.quantity,
            unit_price=item.unit_price,
            total=item.total,
        )
        for item in prepared.items
    ]


def _commit(db: Session) -> None:
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise SaleInvoicePersistenceError() from exc


def create_draft_invoice(db: Session, data: SaleInvoiceDraftCreate) -> SaleInvoice:
    prepared = _prepare_draft(
        db,
        customer_id=data.customer_id,
        currency=data.currency,
        note=data.note,
        discount=data.discount,
        paid_amount=data.paid_amount,
        item_inputs=data.items,
    )
    now = datetime.now(timezone.utc)
    invoice = SaleInvoice(
        invoice_number=_next_invoice_number(db, now.year),
        status="draft",
        completed_at=None,
        cancelled_at=None,
        cancellation_reason="",
        completion_transaction_id=None,
        reversed_customer_transaction_id=None,
    )
    _apply_prepared(invoice, prepared)
    db.add(invoice)
    _commit(db)
    return get_invoice(db, invoice.id)


def get_invoice(db: Session, invoice_id: int) -> SaleInvoice:
    invoice = db.scalar(
        select(SaleInvoice)
        .options(selectinload(SaleInvoice.items))
        .execution_options(populate_existing=True)
        .where(SaleInvoice.id == invoice_id)
    )
    if invoice is None:
        raise SaleInvoiceNotFoundError()
    return invoice


def update_draft_invoice(
    db: Session, invoice_id: int, data: SaleInvoiceDraftUpdate
) -> SaleInvoice:
    invoice = get_invoice(db, invoice_id)
    if invoice.status != "draft":
        raise SaleInvoiceNotDraftError()
    supplied = data.model_fields_set
    customer_id = data.customer_id if "customer_id" in supplied else invoice.customer_id
    currency = data.currency if "currency" in supplied else invoice.currency
    note = data.note if "note" in supplied else invoice.note
    discount = data.discount if "discount" in supplied else invoice.discount
    paid_amount = data.paid_amount if "paid_amount" in supplied else invoice.paid_amount
    if "items" in supplied:
        item_inputs = data.items
    else:
        item_inputs = [
            SaleInvoiceItemCreate(
                product_id=item.product_id,
                quantity=item.quantity,
                unit_price=item.unit_price,
            )
            for item in invoice.items
        ]
    prepared = _prepare_draft(
        db,
        customer_id=customer_id,
        currency=currency,
        note=note,
        discount=discount,
        paid_amount=paid_amount,
        item_inputs=item_inputs,
    )
    _apply_prepared(invoice, prepared)
    invoice.updated_at = datetime.now(timezone.utc)
    _commit(db)
    return get_invoice(db, invoice.id)


def delete_draft_invoice(db: Session, invoice_id: int) -> None:
    invoice = get_invoice(db, invoice_id)
    if invoice.status != "draft":
        raise SaleInvoiceNotDraftError()
    db.delete(invoice)
    _commit(db)


def list_invoices(
    db: Session,
    *,
    search: str | None,
    invoice_status: str | None,
    currency: str | None,
    customer_id: int | None,
    date_from: datetime | None,
    date_to: datetime | None,
    page: int,
    page_size: int,
) -> InvoicePage:
    if date_from and date_to and date_from > date_to:
        raise InvalidDateRangeError()
    filters = []
    if search and (term := search.strip()):
        pattern = f"%{term}%"
        filters.append(
            or_(
                SaleInvoice.invoice_number.ilike(pattern),
                SaleInvoice.customer_name_snapshot.ilike(pattern),
            )
        )
    if invoice_status:
        filters.append(SaleInvoice.status == invoice_status)
    if currency:
        filters.append(SaleInvoice.currency == currency)
    if customer_id is not None:
        filters.append(SaleInvoice.customer_id == customer_id)
    if date_from:
        filters.append(SaleInvoice.created_at >= date_from)
    if date_to:
        filters.append(SaleInvoice.created_at <= date_to)
    total = db.scalar(select(func.count()).select_from(SaleInvoice).where(*filters)) or 0
    item_count = (
        select(func.count(SaleInvoiceItem.id))
        .where(SaleInvoiceItem.invoice_id == SaleInvoice.id)
        .correlate(SaleInvoice)
        .scalar_subquery()
    )
    rows = db.execute(
        select(SaleInvoice, item_count)
        .where(*filters)
        .order_by(SaleInvoice.created_at.desc(), SaleInvoice.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return InvoicePage([(row[0], row[1]) for row in rows], total)


def _locked_invoice(db: Session, invoice_id: int) -> SaleInvoice:
    invoice = db.scalar(
        select(SaleInvoice)
        .options(selectinload(SaleInvoice.items))
        .where(SaleInvoice.id == invoice_id)
        .with_for_update()
    )
    if invoice is None:
        raise SaleInvoiceNotFoundError()
    return invoice


def _validate_stored_totals(invoice: SaleInvoice) -> None:
    if not invoice.items:
        raise InvoiceMalformedError("Invoice must contain at least one item")
    subtotal = Decimal("0")
    seen: set[int] = set()
    for item in invoice.items:
        if item.product_id in seen or item.quantity <= 0 or item.unit_price <= 0:
            raise InvoiceMalformedError()
        seen.add(item.product_id)
        line_total = _money(item.quantity * item.unit_price)
        if item.total != line_total:
            raise InvoiceMalformedError("Stored invoice line total is invalid")
        subtotal += line_total
    subtotal = _money(subtotal)
    total = _money(subtotal - invoice.discount)
    remaining = _money(total - invoice.paid_amount)
    if (
        invoice.discount < 0
        or invoice.discount > subtotal
        or invoice.paid_amount < 0
        or invoice.subtotal != subtotal
        or invoice.total != total
        or invoice.remaining_amount != remaining
    ):
        raise InvoiceMalformedError("Stored invoice totals are invalid")


def _lock_invoice_products(
    db: Session, invoice: SaleInvoice, *, require_sufficient_stock: bool
) -> dict[int, Product]:
    product_ids = sorted({item.product_id for item in invoice.items})
    products = list(
        db.scalars(
            select(Product)
            .where(Product.id.in_(product_ids))
            .order_by(Product.id.asc())
            .with_for_update()
        ).all()
    )
    by_id = {product.id: product for product in products}
    missing = [
        {
            "productId": item.product_id,
            "productCodeSnapshot": item.product_code_snapshot,
            "productNameSnapshot": item.product_name_snapshot,
            "unit": item.unit,
        }
        for item in invoice.items
        if item.product_id not in by_id
    ]
    if missing:
        raise InvoiceMissingProductsError(missing)
    for item in invoice.items:
        product = by_id[item.product_id]
        if product.unit != item.unit:
            raise InvoiceProductUnitChangedError(
                product_id=product.id, expected=item.unit, current=product.unit
            )
        if product.unit == "قطعة" and item.quantity != item.quantity.to_integral_value():
            raise InvalidPieceQuantityError()
        if require_sufficient_stock and item.quantity > product.quantity:
            raise InvoiceCompletionStockError(
                product_id=product.id,
                code=product.code,
                name=product.name,
                requested=item.quantity,
                available=product.quantity,
                unit=product.unit,
            )
    return by_id


def _ensure_no_completion_evidence(db: Session, invoice: SaleInvoice) -> None:
    movement_exists = db.scalar(
        select(StockMovement.id)
        .where(
            StockMovement.source_type == "sale_invoice",
            StockMovement.source_id == invoice.id,
        )
        .limit(1)
    )
    transaction_exists = db.scalar(
        select(CustomerTransaction.id)
        .where(
            CustomerTransaction.source_type == "sale_invoice",
            CustomerTransaction.source_id == invoice.id,
        )
        .limit(1)
    )
    if movement_exists is not None or transaction_exists is not None:
        raise InvoiceLifecycleIntegrityError(
            "duplicate_invoice_completion_evidence",
            "Invoice completion effects already exist",
        )


def complete_invoice(db: Session, invoice_id: int) -> SaleInvoice:
    try:
        invoice = _locked_invoice(db, invoice_id)
        if invoice.status == "completed":
            raise SaleInvoiceAlreadyCompletedError()
        if invoice.status != "draft":
            raise SaleInvoiceNotDraftError()
        _validate_stored_totals(invoice)
        _ensure_no_completion_evidence(db, invoice)
        if invoice.customer_id is None:
            if invoice.remaining_amount > 0:
                raise CashSaleUnpaidError()
        elif db.get(Customer, invoice.customer_id) is None:
            raise CustomerNotFoundError()

        products = _lock_invoice_products(db, invoice, require_sufficient_stock=True)
        completed_at = datetime.now(timezone.utc)
        for item in sorted(invoice.items, key=lambda value: value.product_id):
            product = products[item.product_id]
            inventory_service.create_internal_stock_movement(
                db,
                product_id=product.id,
                movement_type="out",
                quantity=item.quantity,
                source_type="sale_invoice",
                source_id=invoice.id,
                source_reference=invoice.invoice_number,
                note=f"بيع بموجب الفاتورة {invoice.invoice_number}",
                created_at=completed_at,
                locked_product=product,
            )

        transaction: CustomerTransaction | None = None
        if invoice.customer_id is not None and invoice.remaining_amount != 0:
            is_debt = invoice.remaining_amount > 0
            transaction = customer_transaction_service.create_internal_transaction(
                db,
                customer_id=invoice.customer_id,
                transaction_type="debt" if is_debt else "credit",
                amount=abs(invoice.remaining_amount),
                currency=invoice.currency,
                note=(
                    f"متبقي فاتورة البيع {invoice.invoice_number}"
                    if is_debt
                    else f"مبلغ زائد من فاتورة البيع {invoice.invoice_number}"
                ),
                source_type="sale_invoice",
                source_id=invoice.id,
                source_reference=invoice.invoice_number,
                created_at=completed_at,
                commit=False,
            )

        invoice.status = "completed"
        invoice.completed_at = completed_at
        invoice.updated_at = completed_at
        invoice.completion_transaction_id = transaction.id if transaction else None
        invoice.cancelled_at = None
        invoice.cancellation_reason = ""
        invoice.reversed_customer_transaction_id = None
        _commit(db)
        return get_invoice(db, invoice.id)
    except Exception:
        db.rollback()
        raise


def _validate_cancellation_evidence(db: Session, invoice: SaleInvoice) -> None:
    reversals = db.scalar(
        select(func.count())
        .select_from(StockMovement)
        .where(
            StockMovement.source_type == "sale_invoice_cancellation",
            StockMovement.source_id == invoice.id,
        )
    ) or 0
    if reversals:
        raise InvoiceLifecycleIntegrityError(
            "duplicate_invoice_cancellation_evidence",
            "Invoice cancellation effects already exist",
        )
    originals = list(db.scalars(
        select(StockMovement)
        .where(
            StockMovement.source_type == "sale_invoice",
            StockMovement.source_id == invoice.id,
            StockMovement.movement_type == "out",
        )
    ).all())
    expected = {(item.product_id, item.quantity) for item in invoice.items}
    actual = {
        (movement.product_id, movement.quantity)
        for movement in originals
        if movement.source_reference == invoice.invoice_number
    }
    if len(originals) != len(invoice.items) or actual != expected:
        raise InvoiceLifecycleIntegrityError(
            "invoice_completion_evidence_conflict",
            "Original invoice stock movements are missing or inconsistent",
        )


def _linked_completion_transaction(
    db: Session, invoice: SaleInvoice
) -> CustomerTransaction | None:
    if invoice.completion_transaction_id is None:
        unexpected = db.scalar(
            select(CustomerTransaction.id).where(
                CustomerTransaction.source_type == "sale_invoice",
                CustomerTransaction.source_id == invoice.id,
            ).limit(1)
        )
        if unexpected is not None:
            raise InvoiceLinkedTransactionConflictError()
        return None
    transaction = db.get(CustomerTransaction, invoice.completion_transaction_id)
    replacement_exists = db.scalar(
        select(CustomerTransaction.id)
        .where(CustomerTransaction.corrected_transaction_id == invoice.completion_transaction_id)
        .limit(1)
    )
    if (
        transaction is None
        or invoice.customer_id is None
        or transaction.customer_id != invoice.customer_id
        or transaction.source_type != "sale_invoice"
        or transaction.source_id != invoice.id
        or transaction.source_reference != invoice.invoice_number
        or transaction.status != "active"
        or replacement_exists is not None
    ):
        raise InvoiceLinkedTransactionConflictError()
    return transaction


def cancel_invoice(db: Session, invoice_id: int, reason: str) -> SaleInvoice:
    try:
        invoice = _locked_invoice(db, invoice_id)
        if invoice.status != "completed":
            raise SaleInvoiceNotCompletedError(invoice.status)
        _validate_stored_totals(invoice)
        _validate_cancellation_evidence(db, invoice)
        products = _lock_invoice_products(db, invoice, require_sufficient_stock=False)
        linked_transaction = _linked_completion_transaction(db, invoice)
        cancelled_at = datetime.now(timezone.utc)

        for item in sorted(invoice.items, key=lambda value: value.product_id):
            product = products[item.product_id]
            inventory_service.create_internal_stock_movement(
                db,
                product_id=product.id,
                movement_type="in",
                quantity=item.quantity,
                source_type="sale_invoice_cancellation",
                source_id=invoice.id,
                source_reference=invoice.invoice_number,
                note=f"إرجاع مخزون بسبب إلغاء الفاتورة {invoice.invoice_number}",
                created_at=cancelled_at,
                locked_product=product,
            )

        if linked_transaction is not None:
            customer_transaction_service.void_transaction(
                db,
                invoice.customer_id,
                linked_transaction.id,
                f"إلغاء فاتورة البيع {invoice.invoice_number}: {reason.strip()}",
                allow_source_linked=True,
                commit=False,
                voided_at=cancelled_at,
            )

        invoice.status = "cancelled"
        invoice.cancelled_at = cancelled_at
        invoice.cancellation_reason = reason.strip()
        invoice.updated_at = cancelled_at
        invoice.reversed_customer_transaction_id = (
            linked_transaction.id if linked_transaction else None
        )
        _commit(db)
        return get_invoice(db, invoice.id)
    except Exception:
        db.rollback()
        raise


def get_sales_summary(db: Session, currency: str) -> dict[str, object]:
    invoices = list(
        db.scalars(select(SaleInvoice).where(SaleInvoice.currency == currency)).all()
    )
    completed = [invoice for invoice in invoices if invoice.status == "completed"]
    return {
        "currency": currency,
        "total_invoice_count": len(invoices),
        "draft_invoice_count": sum(invoice.status == "draft" for invoice in invoices),
        "completed_invoice_count": len(completed),
        "cancelled_invoice_count": sum(invoice.status == "cancelled" for invoice in invoices),
        "completed_sales_total": _money(
            sum((invoice.total for invoice in completed), start=Decimal("0"))
        ),
        "positive_remaining_total": _money(
            sum(
                (invoice.remaining_amount for invoice in completed if invoice.remaining_amount > 0),
                start=Decimal("0"),
            )
        ),
    }
