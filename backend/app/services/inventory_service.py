from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal

from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import (
    InsufficientStockError,
    InvalidDateRangeError,
    InvalidPieceQuantityError,
    NoOpStockAdjustmentError,
    ProductNotFoundError,
    StockMovementNotFoundError,
    StockMovementPersistenceError,
    UnsupportedStockSourceError,
)
from app.models.product import Product
from app.models.stock_movement import StockMovement
from app.schemas.inventory import StockAdjustmentRequest, StockInRequest, StockOutRequest

SUPPORTED_SOURCE_TYPES = {
    "manual",
    "sale_invoice",
    "sale_invoice_cancellation",
    "migration",
}


@dataclass(frozen=True)
class MovementWithProduct:
    movement: StockMovement
    product: Product


@dataclass(frozen=True)
class MovementPage:
    items: list[MovementWithProduct]
    total: int


def _lock_product(db: Session, product_id: int) -> Product:
    product = db.scalar(
        select(Product).where(Product.id == product_id).with_for_update()
    )
    if product is None:
        raise ProductNotFoundError()
    return product


def _validate_unit_quantity(product: Product, quantity: Decimal) -> None:
    if product.unit == "قطعة" and quantity != quantity.to_integral_value():
        raise InvalidPieceQuantityError()


def _commit(db: Session) -> None:
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise StockMovementPersistenceError() from exc


def create_internal_stock_movement(
    db: Session,
    *,
    product_id: int,
    movement_type: str,
    quantity: Decimal | None = None,
    final_quantity: Decimal | None = None,
    source_type: str,
    source_id: int | None = None,
    source_reference: str = "",
    note: str = "",
    created_at: datetime | None = None,
    locked_product: Product | None = None,
) -> StockMovement:
    """Create and flush a movement without committing the caller's transaction."""
    if source_type not in SUPPORTED_SOURCE_TYPES:
        raise UnsupportedStockSourceError()
    if movement_type not in {"in", "out", "adjustment"}:
        raise StockMovementPersistenceError()

    product = locked_product or _lock_product(db, product_id)
    if product.id != product_id:
        raise ProductNotFoundError()
    previous = product.quantity
    if movement_type == "adjustment":
        if final_quantity is None or final_quantity < 0:
            raise StockMovementPersistenceError()
        _validate_unit_quantity(product, final_quantity)
        if final_quantity == previous:
            raise NoOpStockAdjustmentError()
        new_quantity = final_quantity
        movement_quantity = abs(final_quantity - previous)
    else:
        if quantity is None or quantity <= 0:
            raise StockMovementPersistenceError()
        _validate_unit_quantity(product, quantity)
        movement_quantity = quantity
        if movement_type == "in":
            new_quantity = previous + quantity
        else:
            if quantity > previous:
                raise InsufficientStockError(
                    product_id=product.id,
                    code=product.code,
                    requested=quantity,
                    available=previous,
                    unit=product.unit,
                )
            new_quantity = previous - quantity

    product.quantity = new_quantity
    movement = StockMovement(
        product_id=product.id,
        movement_type=movement_type,
        quantity=movement_quantity,
        previous_quantity=previous,
        new_quantity=new_quantity,
        note=note.strip(),
        source_type=source_type,
        source_id=source_id,
        source_reference=source_reference.strip(),
        created_at=created_at,
    )
    db.add(movement)
    db.flush()
    return movement


def _create_public_movement(
    db: Session,
    *,
    product_id: int,
    movement_type: str,
    quantity: Decimal | None = None,
    final_quantity: Decimal | None = None,
    note: str,
) -> StockMovement:
    movement = create_internal_stock_movement(
        db,
        product_id=product_id,
        movement_type=movement_type,
        quantity=quantity,
        final_quantity=final_quantity,
        source_type="manual",
        note=note,
    )
    _commit(db)
    db.refresh(movement)
    return movement


def create_stock_in(db: Session, data: StockInRequest) -> StockMovement:
    return _create_public_movement(
        db,
        product_id=data.product_id,
        movement_type="in",
        quantity=data.quantity,
        note=data.note,
    )


def create_stock_out(db: Session, data: StockOutRequest) -> StockMovement:
    return _create_public_movement(
        db,
        product_id=data.product_id,
        movement_type="out",
        quantity=data.quantity,
        note=data.note,
    )


def create_stock_adjustment(db: Session, data: StockAdjustmentRequest) -> StockMovement:
    return _create_public_movement(
        db,
        product_id=data.product_id,
        movement_type="adjustment",
        final_quantity=data.final_quantity,
        note=data.note,
    )


def _joined_movement(db: Session, movement_id: int) -> MovementWithProduct:
    row = db.execute(
        select(StockMovement, Product)
        .join(Product, Product.id == StockMovement.product_id)
        .where(StockMovement.id == movement_id)
    ).one_or_none()
    if row is None:
        raise StockMovementNotFoundError()
    return MovementWithProduct(row[0], row[1])


def get_stock_movement(db: Session, movement_id: int) -> MovementWithProduct:
    return _joined_movement(db, movement_id)


def list_stock_movements(
    db: Session,
    *,
    product_id: int | None,
    movement_type: str | None,
    source_type: str | None,
    search: str | None,
    date_from: datetime | None,
    date_to: datetime | None,
    page: int,
    page_size: int,
) -> MovementPage:
    if date_from and date_to and date_from > date_to:
        raise InvalidDateRangeError()
    filters = []
    if product_id is not None:
        filters.append(StockMovement.product_id == product_id)
    if movement_type:
        filters.append(StockMovement.movement_type == movement_type)
    if source_type:
        filters.append(StockMovement.source_type == source_type)
    if date_from:
        filters.append(StockMovement.created_at >= date_from)
    if date_to:
        filters.append(StockMovement.created_at <= date_to)
    if search and (term := search.strip()):
        pattern = f"%{term}%"
        filters.append(
            or_(
                Product.code.ilike(pattern),
                Product.name.ilike(pattern),
                StockMovement.source_reference.ilike(pattern),
                StockMovement.note.ilike(pattern),
            )
        )
    base = select(StockMovement, Product).join(Product, Product.id == StockMovement.product_id)
    total = db.scalar(
        select(func.count()).select_from(StockMovement).join(Product).where(*filters)
    ) or 0
    rows = db.execute(
        base.where(*filters)
        .order_by(StockMovement.created_at.desc(), StockMovement.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return MovementPage(
        [MovementWithProduct(row[0], row[1]) for row in rows], total
    )


def get_inventory_summary(db: Session) -> dict[str, object]:
    products = list(db.scalars(select(Product)).all())
    zero = Decimal("0.000000")
    return {
        "total_products": len(products),
        "total_square_meters": sum(
            (p.quantity for p in products if p.unit == "متر مربع"), start=zero
        ),
        "total_pieces": sum((p.quantity for p in products if p.unit == "قطعة"), start=zero),
        "low_stock_count": sum(1 for p in products if 0 < p.quantity <= p.minimum_quantity),
        "out_of_stock_count": sum(1 for p in products if p.quantity <= 0),
        "total_sale_value_iqd": sum(
            (p.quantity * p.sell_price_iqd for p in products), start=zero
        ),
        "total_purchase_value_usd": sum(
            (p.quantity * p.purchase_price_usd for p in products), start=zero
        ),
    }


def list_low_stock_products(
    db: Session, *, include_out_of_stock: bool, limit: int
) -> list[Product]:
    products = list(db.scalars(select(Product)).all())
    selected = [
        product
        for product in products
        if (include_out_of_stock and product.quantity <= 0)
        or (product.quantity > 0 and product.quantity <= product.minimum_quantity)
    ]

    def sort_key(product: Product) -> tuple[object, ...]:
        is_out = product.quantity <= 0
        ratio = (
            product.quantity / product.minimum_quantity
            if product.minimum_quantity > 0
            else product.quantity
        )
        return (0 if is_out else 1, ratio, product.code.lower(), product.id)

    return sorted(selected, key=sort_key)[:limit]
