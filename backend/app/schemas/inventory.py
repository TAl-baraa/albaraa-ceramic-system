from datetime import datetime
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints
from pydantic.alias_generators import to_camel

MovementType = Literal["in", "out", "adjustment"]
SourceType = Literal["manual", "sale_invoice", "sale_invoice_cancellation", "migration"]
PositiveQuantity = Annotated[Decimal, Field(gt=0, max_digits=18, decimal_places=6)]
NonnegativeQuantity = Annotated[Decimal, Field(ge=0, max_digits=18, decimal_places=6)]
TrimmedText = Annotated[str, StringConstraints(strip_whitespace=True)]
RequiredText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class InventorySchema(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel, populate_by_name=True, from_attributes=True, extra="forbid"
    )


class StockInRequest(InventorySchema):
    product_id: int = Field(gt=0)
    quantity: PositiveQuantity
    note: TrimmedText = ""


class StockOutRequest(StockInRequest):
    pass


class StockAdjustmentRequest(InventorySchema):
    product_id: int = Field(gt=0)
    final_quantity: NonnegativeQuantity
    note: RequiredText


class StockMovementRead(InventorySchema):
    id: int
    product_id: int
    movement_type: MovementType
    quantity: Decimal
    previous_quantity: Decimal
    new_quantity: Decimal
    note: str
    source_type: str
    source_id: int | None
    source_reference: str
    created_at: datetime
    product_code: str
    product_name: str
    product_unit: Literal["متر مربع", "قطعة"]


class StockMovementListResponse(InventorySchema):
    items: list[StockMovementRead]
    total: int
    page: int
    page_size: int
    total_pages: int


class InventorySummaryRead(InventorySchema):
    total_products: int
    total_square_meters: Decimal
    total_pieces: Decimal
    low_stock_count: int
    out_of_stock_count: int
    total_sale_value_iqd: Decimal
    total_purchase_value_usd: Decimal


class LowStockProductRead(InventorySchema):
    product_id: int
    code: str
    name: str
    quantity: Decimal
    minimum_quantity: Decimal
    unit: Literal["متر مربع", "قطعة"]
    status: Literal["out_of_stock", "low_stock"]
