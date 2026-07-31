from datetime import datetime
from math import ceil
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.customer import Customer
from app.models.customer_transaction import CustomerTransaction
from app.schemas.customer import (
    BalanceValue,
    CustomerBalanceRead,
    CustomerCreate,
    CustomerListResponse,
    CustomerRead,
    CustomerTransactionCreate,
    CustomerTransactionListResponse,
    CustomerTransactionRead,
    CustomerUpdate,
    TransactionCorrectionRequest,
    TransactionCorrectionResponse,
    TransactionVoidRequest,
)
from app.services import customer_service, customer_transaction_service
from app.services.customer_accounting import balance_status, transaction_effect

router = APIRouter(prefix="/customers", tags=["customers"])
DatabaseSession = Annotated[Session, Depends(get_db)]


def balance_response(customer_id: int, balances: dict[str, object]) -> CustomerBalanceRead:
    return CustomerBalanceRead(
        customer_id=customer_id,
        IQD=BalanceValue(balance=balances["IQD"], status=balance_status(balances["IQD"])),
        USD=BalanceValue(balance=balances["USD"], status=balance_status(balances["USD"])),
    )


def customer_response(
    customer: Customer,
    *,
    summary: customer_service.CustomerSummary | None = None,
) -> CustomerRead:
    data = {
        "id": customer.id,
        "name": customer.name,
        "phone": customer.phone,
        "address": customer.address,
        "notes": customer.notes,
        "created_at": customer.created_at,
        "updated_at": customer.updated_at,
        "last_payment_at": summary.last_payment_at if summary else None,
        "balances": balance_response(customer.id, summary.balances) if summary else None,
    }
    return CustomerRead.model_validate(data)


def transaction_response(
    transaction: CustomerTransaction, running_balance: object | None = None
) -> CustomerTransactionRead:
    effect = (
        transaction_effect(transaction.transaction_type, transaction.amount)
        if transaction.status == "active"
        else 0
    )
    return CustomerTransactionRead.model_validate(
        {
            **{column.name: getattr(transaction, column.name) for column in transaction.__table__.columns},
            "effect_amount": effect,
            "running_balance": running_balance,
        }
    )


@router.post("", response_model=CustomerRead, status_code=status.HTTP_201_CREATED)
def create_customer(data: CustomerCreate, db: DatabaseSession) -> CustomerRead:
    return customer_response(customer_service.create_customer(db, data))


@router.get("", response_model=CustomerListResponse)
def list_customers(
    db: DatabaseSession,
    search: Annotated[str | None, Query(max_length=255)] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(alias="pageSize", ge=1, le=100)] = 20,
    include_balances: Annotated[bool, Query(alias="includeBalances")] = False,
) -> CustomerListResponse:
    result = customer_service.list_customers(
        db,
        search=search,
        page=page,
        page_size=page_size,
        include_balances=include_balances,
    )
    return CustomerListResponse(
        items=[
            customer_response(customer, summary=result.summaries.get(customer.id))
            for customer in result.items
        ],
        total=result.total,
        page=page,
        page_size=page_size,
        total_pages=ceil(result.total / page_size) if result.total else 0,
    )


@router.get("/{customer_id}", response_model=CustomerRead)
def get_customer(
    customer_id: int,
    db: DatabaseSession,
    include_balances: Annotated[bool, Query(alias="includeBalances")] = False,
) -> CustomerRead:
    customer = customer_service.get_customer(db, customer_id)
    summary = customer_service.get_customer_summary(db, customer_id) if include_balances else None
    return customer_response(customer, summary=summary)


@router.patch("/{customer_id}", response_model=CustomerRead)
def update_customer(
    customer_id: int, data: CustomerUpdate, db: DatabaseSession
) -> CustomerRead:
    return customer_response(customer_service.update_customer(db, customer_id, data))


@router.delete("/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_customer(customer_id: int, db: DatabaseSession) -> Response:
    customer_service.delete_customer(db, customer_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{customer_id}/balances", response_model=CustomerBalanceRead)
def get_balances(customer_id: int, db: DatabaseSession) -> CustomerBalanceRead:
    balances = customer_transaction_service.calculate_customer_balance(db, customer_id)
    return balance_response(customer_id, balances)


@router.post(
    "/{customer_id}/transactions",
    response_model=CustomerTransactionRead,
    status_code=status.HTTP_201_CREATED,
)
def create_transaction(
    customer_id: int, data: CustomerTransactionCreate, db: DatabaseSession
) -> CustomerTransactionRead:
    return transaction_response(
        customer_transaction_service.create_transaction(db, customer_id, data)
    )


@router.get(
    "/{customer_id}/transactions", response_model=CustomerTransactionListResponse
)
def list_transactions(
    customer_id: int,
    db: DatabaseSession,
    currency: Literal["IQD", "USD"] | None = None,
    transaction_status: Annotated[
        Literal["active", "voided"] | None, Query(alias="status")
    ] = None,
    transaction_type: Annotated[
        Literal["debt", "credit", "payment_received", "payment_paid"] | None,
        Query(alias="transactionType"),
    ] = None,
    date_from: Annotated[datetime | None, Query(alias="dateFrom")] = None,
    date_to: Annotated[datetime | None, Query(alias="dateTo")] = None,
    include_voided: Annotated[bool, Query(alias="includeVoided")] = True,
    include_running_balance: Annotated[
        bool, Query(alias="includeRunningBalance")
    ] = False,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(alias="pageSize", ge=1, le=100)] = 20,
) -> CustomerTransactionListResponse:
    result = customer_transaction_service.list_transactions(
        db,
        customer_id,
        currency=currency,
        transaction_status=transaction_status,
        transaction_type=transaction_type,
        date_from=date_from,
        date_to=date_to,
        include_voided=include_voided,
        include_running_balance=include_running_balance,
        page=page,
        page_size=page_size,
    )
    return CustomerTransactionListResponse(
        items=[
            transaction_response(item, result.running_balances.get(item.id))
            for item in result.items
        ],
        total=result.total,
        page=page,
        page_size=page_size,
        total_pages=ceil(result.total / page_size) if result.total else 0,
    )


@router.get(
    "/{customer_id}/transactions/{transaction_id}",
    response_model=CustomerTransactionRead,
)
def get_transaction(
    customer_id: int, transaction_id: int, db: DatabaseSession
) -> CustomerTransactionRead:
    return transaction_response(
        customer_transaction_service.get_transaction(db, customer_id, transaction_id)
    )


@router.post(
    "/{customer_id}/transactions/{transaction_id}/correct",
    response_model=TransactionCorrectionResponse,
)
def correct_transaction(
    customer_id: int,
    transaction_id: int,
    data: TransactionCorrectionRequest,
    db: DatabaseSession,
) -> TransactionCorrectionResponse:
    original, replacement = customer_transaction_service.correct_transaction(
        db, customer_id, transaction_id, data
    )
    balances = customer_transaction_service.calculate_customer_balance(db, customer_id)
    return TransactionCorrectionResponse(
        original=transaction_response(original),
        replacement=transaction_response(replacement),
        balances=balance_response(customer_id, balances),
    )


@router.post(
    "/{customer_id}/transactions/{transaction_id}/void",
    response_model=CustomerTransactionRead,
)
def void_transaction(
    customer_id: int,
    transaction_id: int,
    data: TransactionVoidRequest,
    db: DatabaseSession,
) -> CustomerTransactionRead:
    return transaction_response(
        customer_transaction_service.void_transaction(
            db, customer_id, transaction_id, data.reason
        )
    )
