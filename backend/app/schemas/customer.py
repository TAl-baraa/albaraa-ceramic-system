from datetime import datetime
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator
from pydantic.alias_generators import to_camel

RequiredText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
OptionalText = Annotated[str, StringConstraints(strip_whitespace=True)]
Currency = Literal["IQD", "USD"]
TransactionType = Literal["debt", "credit", "payment_received", "payment_paid"]
TransactionStatus = Literal["active", "voided"]
SourceType = Literal["manual", "sale_invoice"]
PositiveAmount = Annotated[Decimal, Field(gt=0, max_digits=24, decimal_places=6)]
BalanceStatus = Literal["owes_store", "store_owes", "settled"]


class CustomerSchema(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel, populate_by_name=True, from_attributes=True, extra="forbid"
    )


class BalanceValue(CustomerSchema):
    balance: Decimal
    status: BalanceStatus


class CustomerBalanceRead(CustomerSchema):
    customer_id: int
    IQD: BalanceValue = Field(serialization_alias="IQD", validation_alias="IQD")
    USD: BalanceValue = Field(serialization_alias="USD", validation_alias="USD")


class CustomerCreate(CustomerSchema):
    name: RequiredText = Field(max_length=255)
    phone: OptionalText = Field(default="", max_length=100)
    address: OptionalText = ""
    notes: OptionalText = ""


class CustomerUpdate(CustomerSchema):
    name: RequiredText | None = Field(default=None, max_length=255)
    phone: OptionalText | None = Field(default=None, max_length=100)
    address: OptionalText | None = None
    notes: OptionalText | None = None

    @model_validator(mode="after")
    def reject_null_fields(self) -> "CustomerUpdate":
        if any(getattr(self, field) is None for field in self.model_fields_set):
            raise ValueError("Supplied customer fields cannot be null")
        return self


class CustomerRead(CustomerSchema):
    id: int
    name: str
    phone: str
    address: str
    notes: str
    created_at: datetime
    updated_at: datetime
    last_payment_at: datetime | None = None
    balances: CustomerBalanceRead | None = None


class CustomerListResponse(CustomerSchema):
    items: list[CustomerRead]
    total: int
    page: int
    page_size: int
    total_pages: int


class CustomerTransactionCreate(CustomerSchema):
    transaction_type: TransactionType = Field(validation_alias="transactionType")
    amount: PositiveAmount
    currency: Currency
    note: OptionalText = ""


class CustomerTransactionRead(CustomerSchema):
    id: int
    customer_id: int
    transaction_type: TransactionType
    amount: Decimal
    currency: Currency
    note: str
    status: TransactionStatus
    corrected_transaction_id: int | None
    voided_at: datetime | None
    void_reason: str
    created_by_correction: bool
    source_type: SourceType
    source_id: int | None
    source_reference: str
    created_at: datetime
    recorded_at: datetime
    updated_at: datetime
    effect_amount: Decimal
    running_balance: Decimal | None = None


class CustomerTransactionListResponse(CustomerSchema):
    items: list[CustomerTransactionRead]
    total: int
    page: int
    page_size: int
    total_pages: int


class TransactionCorrectionRequest(CustomerSchema):
    transaction_type: TransactionType = Field(validation_alias="transactionType")
    amount: PositiveAmount
    note: OptionalText = ""
    reason: RequiredText


class TransactionVoidRequest(CustomerSchema):
    reason: RequiredText


class TransactionCorrectionResponse(CustomerSchema):
    original: CustomerTransactionRead
    replacement: CustomerTransactionRead
    balances: CustomerBalanceRead
