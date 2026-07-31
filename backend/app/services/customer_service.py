from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal

from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import (
    CustomerHasTransactionsError,
    CustomerNotFoundError,
    DuplicateCustomerPhoneError,
)
from app.models.customer import Customer
from app.models.customer_transaction import CustomerTransaction
from app.schemas.customer import CustomerCreate, CustomerUpdate
from app.services.customer_accounting import transaction_effect, zero_balance


@dataclass(frozen=True)
class CustomerSummary:
    balances: dict[str, Decimal]
    last_payment_at: datetime | None


@dataclass(frozen=True)
class CustomerPage:
    items: list[Customer]
    total: int
    summaries: dict[int, CustomerSummary]


def _commit(db: Session) -> None:
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise DuplicateCustomerPhoneError() from exc


def create_customer(db: Session, data: CustomerCreate) -> Customer:
    customer = Customer(**data.model_dump())
    db.add(customer)
    _commit(db)
    db.refresh(customer)
    return customer


def get_customer(db: Session, customer_id: int) -> Customer:
    customer = db.get(Customer, customer_id)
    if customer is None:
        raise CustomerNotFoundError()
    return customer


def _summaries_for_customers(
    db: Session, customer_ids: list[int]
) -> dict[int, CustomerSummary]:
    if not customer_ids:
        return {}
    transactions = db.scalars(
        select(CustomerTransaction)
        .where(CustomerTransaction.customer_id.in_(customer_ids))
        .order_by(CustomerTransaction.created_at.asc(), CustomerTransaction.id.asc())
    ).all()
    balances = {
        customer_id: {"IQD": zero_balance(), "USD": zero_balance()}
        for customer_id in customer_ids
    }
    payments: dict[int, datetime | None] = dict.fromkeys(customer_ids)
    for transaction in transactions:
        if transaction.status != "active":
            continue
        balances[transaction.customer_id][transaction.currency] += transaction_effect(
            transaction.transaction_type, transaction.amount
        )
        if transaction.transaction_type in ("payment_received", "payment_paid"):
            previous = payments[transaction.customer_id]
            if previous is None or transaction.created_at > previous:
                payments[transaction.customer_id] = transaction.created_at
    return {
        customer_id: CustomerSummary(balances[customer_id], payments[customer_id])
        for customer_id in customer_ids
    }


def list_customers(
    db: Session,
    *,
    search: str | None,
    page: int,
    page_size: int,
    include_balances: bool,
) -> CustomerPage:
    filters = []
    if search and (term := search.strip()):
        pattern = f"%{term}%"
        filters.append(or_(Customer.name.ilike(pattern), Customer.phone.ilike(pattern)))
    total = db.scalar(select(func.count()).select_from(Customer).where(*filters)) or 0
    items = list(
        db.scalars(
            select(Customer)
            .where(*filters)
            .order_by(Customer.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        ).all()
    )
    summaries = (
        _summaries_for_customers(db, [customer.id for customer in items])
        if include_balances
        else {}
    )
    return CustomerPage(items, total, summaries)


def get_customer_summary(db: Session, customer_id: int) -> CustomerSummary:
    get_customer(db, customer_id)
    return _summaries_for_customers(db, [customer_id])[customer_id]


def update_customer(db: Session, customer_id: int, data: CustomerUpdate) -> Customer:
    customer = get_customer(db, customer_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(customer, field, value)
    _commit(db)
    db.refresh(customer)
    return customer


def delete_customer(db: Session, customer_id: int) -> None:
    """Physically delete only customers with no permanent financial history."""
    customer = get_customer(db, customer_id)
    has_transactions = db.scalar(
        select(CustomerTransaction.id)
        .where(CustomerTransaction.customer_id == customer_id)
        .limit(1)
    )
    if has_transactions is not None:
        raise CustomerHasTransactionsError()
    db.delete(customer)
    _commit(db)
