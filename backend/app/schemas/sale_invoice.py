from datetime import datetime
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator
from pydantic.alias_generators import to_camel

Currency = Literal["IQD", "USD"]
InvoiceStatus = Literal["draft", "completed", "cancelled"]
Quantity = Annotated[Decimal, Field(gt=0, max_digits=18, decimal_places=6)]
PositiveAmount = Annotated[Decimal, Field(gt=0, max_digits=24, decimal_places=6)]
NonnegativeAmount = Annotated[Decimal, Field(ge=0, max_digits=24, decimal_places=6)]
TrimmedText = Annotated[str, StringConstraints(strip_whitespace=True)]


class SaleSchema(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel, populate_by_name=True, from_attributes=True, extra="forbid"
    )


class SaleInvoiceItemCreate(SaleSchema):
    product_id: int = Field(gt=0)
    quantity: Quantity
    unit_price: PositiveAmount


class SaleInvoiceDraftCreate(SaleSchema):
    customer_id: int | None = Field(default=None, gt=0)
    currency: Currency
    note: TrimmedText = ""
    discount: NonnegativeAmount = Decimal("0")
    paid_amount: NonnegativeAmount = Decimal("0")
    items: list[SaleInvoiceItemCreate] = Field(min_length=1)


class SaleInvoiceDraftUpdate(SaleSchema):
    customer_id: int | None = Field(default=None, gt=0)
    currency: Currency | None = None
    note: TrimmedText | None = None
    discount: NonnegativeAmount | None = None
    paid_amount: NonnegativeAmount | None = None
    items: list[SaleInvoiceItemCreate] | None = Field(default=None, min_length=1)

    @model_validator(mode="after")
    def reject_null_non_customer_fields(self) -> "SaleInvoiceDraftUpdate":
        nullable = {"customer_id"}
        if any(
            getattr(self, field) is None
            for field in self.model_fields_set
            if field not in nullable
        ):
            raise ValueError("Supplied draft fields other than customerId cannot be null")
        return self


class SaleInvoiceItemRead(SaleSchema):
    id: int
    invoice_id: int
    product_id: int
    product_code_snapshot: str
    product_name_snapshot: str
    unit: Literal["متر مربع", "قطعة"]
    quantity: Decimal
    unit_price: Decimal
    total: Decimal
    created_at: datetime


class SaleInvoiceListItemRead(SaleSchema):
    id: int
    invoice_number: str
    customer_id: int | None
    customer_name_snapshot: str
    currency: Currency
    status: InvoiceStatus
    subtotal: Decimal
    discount: Decimal
    total: Decimal
    paid_amount: Decimal
    remaining_amount: Decimal
    item_count: int
    created_at: datetime
    updated_at: datetime


class SaleInvoiceAuditRead(SaleSchema):
    source_reference: str
    stock_movement_count: int
    reversal_movement_count: int
    customer_transaction_created: bool
    customer_transaction_voided: bool


class SaleInvoiceRead(SaleInvoiceListItemRead):
    note: str
    completed_at: datetime | None
    cancelled_at: datetime | None
    cancellation_reason: str
    completion_transaction_id: int | None
    reversed_customer_transaction_id: int | None
    completion_audit: SaleInvoiceAuditRead
    items: list[SaleInvoiceItemRead]


class SaleInvoiceCancellationRequest(SaleSchema):
    reason: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class SalesSummaryRead(SaleSchema):
    currency: Currency
    total_invoice_count: int
    draft_invoice_count: int
    completed_invoice_count: int
    cancelled_invoice_count: int
    completed_sales_total: Decimal
    positive_remaining_total: Decimal


class SaleInvoiceListResponse(SaleSchema):
    items: list[SaleInvoiceListItemRead]
    total: int
    page: int
    page_size: int
    total_pages: int
