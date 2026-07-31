from datetime import datetime
from math import ceil
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.sale_invoice import SaleInvoice
from app.models.customer_transaction import CustomerTransaction
from app.models.stock_movement import StockMovement
from app.schemas.sale_invoice import (
    SaleInvoiceAuditRead,
    SaleInvoiceCancellationRequest,
    SaleInvoiceDraftCreate,
    SaleInvoiceDraftUpdate,
    SaleInvoiceItemRead,
    SaleInvoiceListItemRead,
    SaleInvoiceListResponse,
    SaleInvoiceRead,
    SalesSummaryRead,
)
from app.services import sale_invoice_service

router = APIRouter(prefix="/sales/invoices", tags=["sales invoices"])
summary_router = APIRouter(prefix="/sales", tags=["sales"])
DatabaseSession = Annotated[Session, Depends(get_db)]


def item_response(item: object) -> SaleInvoiceItemRead:
    return SaleInvoiceItemRead.model_validate(item)


def list_item_response(invoice: SaleInvoice, item_count: int) -> SaleInvoiceListItemRead:
    return SaleInvoiceListItemRead.model_validate(
        {
            **{
                field: getattr(invoice, field)
                for field in SaleInvoiceListItemRead.model_fields
                if field != "item_count"
            },
            "item_count": item_count,
        }
    )


def invoice_response(invoice: SaleInvoice, db: Session) -> SaleInvoiceRead:
    stock_movement_count = db.scalar(
        select(func.count()).select_from(StockMovement).where(
            StockMovement.source_type == "sale_invoice",
            StockMovement.source_id == invoice.id,
        )
    ) or 0
    reversal_movement_count = db.scalar(
        select(func.count()).select_from(StockMovement).where(
            StockMovement.source_type == "sale_invoice_cancellation",
            StockMovement.source_id == invoice.id,
        )
    ) or 0
    linked_transaction = (
        db.get(CustomerTransaction, invoice.completion_transaction_id)
        if invoice.completion_transaction_id is not None
        else None
    )
    return SaleInvoiceRead.model_validate(
        {
            **{column.name: getattr(invoice, column.name) for column in invoice.__table__.columns},
            "item_count": len(invoice.items),
            "items": [item_response(item) for item in invoice.items],
            "completion_audit": SaleInvoiceAuditRead(
                source_reference=invoice.invoice_number,
                stock_movement_count=stock_movement_count,
                reversal_movement_count=reversal_movement_count,
                customer_transaction_created=linked_transaction is not None,
                customer_transaction_voided=(
                    linked_transaction is not None and linked_transaction.status == "voided"
                ),
            ),
        }
    )


@router.post("", response_model=SaleInvoiceRead, status_code=status.HTTP_201_CREATED)
def create_invoice(data: SaleInvoiceDraftCreate, db: DatabaseSession) -> SaleInvoiceRead:
    return invoice_response(sale_invoice_service.create_draft_invoice(db, data), db)


@router.get("", response_model=SaleInvoiceListResponse)
def list_invoices(
    db: DatabaseSession,
    search: Annotated[str | None, Query(max_length=255)] = None,
    invoice_status: Annotated[
        Literal["draft", "completed", "cancelled"] | None, Query(alias="status")
    ] = None,
    currency: Literal["IQD", "USD"] | None = None,
    customer_id: Annotated[int | None, Query(alias="customerId", gt=0)] = None,
    date_from: Annotated[datetime | None, Query(alias="dateFrom")] = None,
    date_to: Annotated[datetime | None, Query(alias="dateTo")] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(alias="pageSize", ge=1, le=100)] = 20,
) -> SaleInvoiceListResponse:
    result = sale_invoice_service.list_invoices(
        db,
        search=search,
        invoice_status=invoice_status,
        currency=currency,
        customer_id=customer_id,
        date_from=date_from,
        date_to=date_to,
        page=page,
        page_size=page_size,
    )
    return SaleInvoiceListResponse(
        items=[list_item_response(invoice, count) for invoice, count in result.items],
        total=result.total,
        page=page,
        page_size=page_size,
        total_pages=ceil(result.total / page_size) if result.total else 0,
    )


@router.get("/{invoice_id}", response_model=SaleInvoiceRead)
def get_invoice(invoice_id: int, db: DatabaseSession) -> SaleInvoiceRead:
    return invoice_response(sale_invoice_service.get_invoice(db, invoice_id), db)


@router.patch("/{invoice_id}", response_model=SaleInvoiceRead)
def update_invoice(
    invoice_id: int, data: SaleInvoiceDraftUpdate, db: DatabaseSession
) -> SaleInvoiceRead:
    return invoice_response(sale_invoice_service.update_draft_invoice(db, invoice_id, data), db)


@router.post("/{invoice_id}/complete", response_model=SaleInvoiceRead)
def complete_invoice(invoice_id: int, db: DatabaseSession) -> SaleInvoiceRead:
    return invoice_response(sale_invoice_service.complete_invoice(db, invoice_id), db)


@router.post("/{invoice_id}/cancel", response_model=SaleInvoiceRead)
def cancel_invoice(
    invoice_id: int, data: SaleInvoiceCancellationRequest, db: DatabaseSession
) -> SaleInvoiceRead:
    return invoice_response(
        sale_invoice_service.cancel_invoice(db, invoice_id, data.reason), db
    )


@router.delete("/{invoice_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_invoice(invoice_id: int, db: DatabaseSession) -> Response:
    sale_invoice_service.delete_draft_invoice(db, invoice_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@summary_router.get("/summary", response_model=SalesSummaryRead)
def sales_summary(
    db: DatabaseSession, currency: Literal["IQD", "USD"] = "IQD"
) -> SalesSummaryRead:
    return SalesSummaryRead.model_validate(
        sale_invoice_service.get_sales_summary(db, currency)
    )
