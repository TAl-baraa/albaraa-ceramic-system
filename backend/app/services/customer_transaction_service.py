from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import (
    CustomerNotFoundError,
    CustomerTransactionNotFoundError,
    CustomerTransactionPersistenceError,
    InvalidDateRangeError,
    SourceLinkedTransactionProtectedError,
    TransactionAlreadyVoidedError,
    TransactionCustomerMismatchError,
)
from app.models.customer import Customer
from app.models.customer_transaction import CustomerTransaction
from app.schemas.customer import (
    Currency,
    CustomerTransactionCreate,
    TransactionCorrectionRequest,
    TransactionType,
)
from app.services.customer_accounting import transaction_effect, zero_balance


@dataclass(frozen=True)
class TransactionPage:
    items: list[CustomerTransaction]
    total: int
    running_balances: dict[int, Decimal]


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _commit(db: Session) -> None:
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise CustomerTransactionPersistenceError() from exc


def _require_customer(db: Session, customer_id: int) -> Customer:
    customer = db.get(Customer, customer_id)
    if customer is None:
        raise CustomerNotFoundError()
    return customer


def get_transaction(
    db: Session, customer_id: int, transaction_id: int
) -> CustomerTransaction:
    _require_customer(db, customer_id)
    transaction = db.get(CustomerTransaction, transaction_id)
    if transaction is None:
        raise CustomerTransactionNotFoundError()
    if transaction.customer_id != customer_id:
        raise TransactionCustomerMismatchError()
    return transaction


def create_transaction(
    db: Session, customer_id: int, data: CustomerTransactionCreate
) -> CustomerTransaction:
    return create_internal_transaction(
        db,
        customer_id=customer_id,
        transaction_type=data.transaction_type,
        amount=data.amount,
        currency=data.currency,
        note=data.note,
        source_type="manual",
        commit=True,
    )


def create_internal_transaction(
    db: Session,
    *,
    customer_id: int,
    transaction_type: TransactionType,
    amount: Decimal,
    currency: Currency,
    note: str = "",
    source_type: str = "sale_invoice",
    source_id: int | None = None,
    source_reference: str = "",
    created_at: datetime | None = None,
    commit: bool = True,
) -> CustomerTransaction:
    """Create a source-linked transaction for a trusted future domain service."""
    _require_customer(db, customer_id)
    transaction = CustomerTransaction(
        customer_id=customer_id,
        transaction_type=transaction_type,
        amount=amount,
        currency=currency,
        note=note.strip(),
        status="active",
        corrected_transaction_id=None,
        voided_at=None,
        void_reason="",
        created_by_correction=False,
        source_type=source_type,
        source_id=source_id,
        source_reference=source_reference.strip(),
        created_at=created_at or _now(),
        recorded_at=_now(),
    )
    db.add(transaction)
    if commit:
        _commit(db)
        db.refresh(transaction)
    else:
        db.flush()
    return transaction


def _filtered_transactions(
    db: Session,
    customer_id: int,
    *,
    currency: str | None,
    transaction_status: str | None,
    transaction_type: str | None,
    date_from: datetime | None,
    date_to: datetime | None,
    include_voided: bool,
) -> list[CustomerTransaction]:
    if date_from and date_to and date_from > date_to:
        raise InvalidDateRangeError()
    statement = select(CustomerTransaction).where(
        CustomerTransaction.customer_id == customer_id
    )
    if currency:
        statement = statement.where(CustomerTransaction.currency == currency)
    if transaction_status:
        statement = statement.where(CustomerTransaction.status == transaction_status)
    elif not include_voided:
        statement = statement.where(CustomerTransaction.status == "active")
    if transaction_type:
        statement = statement.where(
            CustomerTransaction.transaction_type == transaction_type
        )
    if date_from:
        statement = statement.where(CustomerTransaction.created_at >= date_from)
    if date_to:
        statement = statement.where(CustomerTransaction.created_at <= date_to)
    return list(
        db.scalars(
            statement.order_by(CustomerTransaction.created_at.asc(), CustomerTransaction.id.asc())
        ).all()
    )


def list_transactions(
    db: Session,
    customer_id: int,
    *,
    currency: str | None,
    transaction_status: str | None,
    transaction_type: str | None,
    date_from: datetime | None,
    date_to: datetime | None,
    include_voided: bool,
    include_running_balance: bool,
    page: int,
    page_size: int,
) -> TransactionPage:
    _require_customer(db, customer_id)
    chronological = _filtered_transactions(
        db,
        customer_id,
        currency=currency,
        transaction_status=transaction_status,
        transaction_type=transaction_type,
        date_from=date_from,
        date_to=date_to,
        include_voided=include_voided,
    )
    balances: dict[str, Decimal] = {"IQD": zero_balance(), "USD": zero_balance()}
    running: dict[int, Decimal] = {}
    for transaction in chronological:
        if transaction.status == "active":
            balances[transaction.currency] += transaction_effect(
                transaction.transaction_type, transaction.amount
            )
        if include_running_balance:
            running[transaction.id] = balances[transaction.currency]
    newest_first = list(reversed(chronological))
    start = (page - 1) * page_size
    return TransactionPage(
        items=newest_first[start : start + page_size],
        total=len(newest_first),
        running_balances=running,
    )


def calculate_customer_balance(
    db: Session, customer_id: int
) -> dict[str, Decimal]:
    _require_customer(db, customer_id)
    transactions = db.scalars(
        select(CustomerTransaction)
        .where(
            CustomerTransaction.customer_id == customer_id,
            CustomerTransaction.status == "active",
        )
        .order_by(CustomerTransaction.created_at.asc(), CustomerTransaction.id.asc())
    ).all()
    balances = {"IQD": zero_balance(), "USD": zero_balance()}
    for transaction in transactions:
        balances[transaction.currency] += transaction_effect(
            transaction.transaction_type, transaction.amount
        )
    return balances


def calculate_customer_running_balances(
    transactions: list[CustomerTransaction],
) -> dict[int, Decimal]:
    balances = {"IQD": zero_balance(), "USD": zero_balance()}
    result: dict[int, Decimal] = {}
    for transaction in sorted(transactions, key=lambda item: (item.created_at, item.id)):
        if transaction.status == "active":
            balances[transaction.currency] += transaction_effect(
                transaction.transaction_type, transaction.amount
            )
        result[transaction.id] = balances[transaction.currency]
    return result


def correct_transaction(
    db: Session,
    customer_id: int,
    transaction_id: int,
    data: TransactionCorrectionRequest,
    *,
    allow_source_linked: bool = False,
) -> tuple[CustomerTransaction, CustomerTransaction]:
    original = get_transaction(db, customer_id, transaction_id)
    if original.status == "voided":
        raise TransactionAlreadyVoidedError()
    if original.source_type == "sale_invoice" and not allow_source_linked:
        raise SourceLinkedTransactionProtectedError()

    corrected_at = _now()
    original.status = "voided"
    original.voided_at = corrected_at
    original.void_reason = data.reason.strip()
    replacement = CustomerTransaction(
        customer_id=original.customer_id,
        transaction_type=data.transaction_type,
        amount=data.amount,
        currency=original.currency,
        note=data.note.strip(),
        status="active",
        corrected_transaction_id=original.id,
        voided_at=None,
        void_reason="",
        created_by_correction=True,
        source_type=original.source_type,
        source_id=original.source_id,
        source_reference=original.source_reference,
        created_at=original.created_at,
        recorded_at=corrected_at,
    )
    db.add(replacement)
    _commit(db)
    db.refresh(original)
    db.refresh(replacement)
    return original, replacement


def void_transaction(
    db: Session,
    customer_id: int,
    transaction_id: int,
    reason: str,
    *,
    allow_source_linked: bool = False,
) -> CustomerTransaction:
    transaction = get_transaction(db, customer_id, transaction_id)
    if transaction.status == "voided":
        raise TransactionAlreadyVoidedError()
    if transaction.source_type == "sale_invoice" and not allow_source_linked:
        raise SourceLinkedTransactionProtectedError()
    transaction.status = "voided"
    transaction.voided_at = _now()
    transaction.void_reason = reason.strip()
    _commit(db)
    db.refresh(transaction)
    return transaction
