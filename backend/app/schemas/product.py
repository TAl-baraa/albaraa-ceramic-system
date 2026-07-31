from datetime import datetime
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator
from pydantic.alias_generators import to_camel

ProductUnit = Literal["متر مربع", "قطعة"]
RequiredText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
Quantity = Annotated[Decimal, Field(ge=0, max_digits=18, decimal_places=6)]
IqdAmount = Annotated[Decimal, Field(ge=0, max_digits=18, decimal_places=0)]
UsdAmount = Annotated[Decimal, Field(ge=0, max_digits=18, decimal_places=4)]


class ProductSchema(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
        ser_json_timedelta="iso8601",
    )


def validate_piece_quantities(
    unit: ProductUnit | None,
    quantity: Decimal | None,
    minimum_quantity: Decimal | None,
) -> None:
    if unit != "قطعة":
        return
    if quantity is not None and quantity != quantity.to_integral_value():
        raise ValueError("Piece quantity must be a whole number")
    if (
        minimum_quantity is not None
        and minimum_quantity != minimum_quantity.to_integral_value()
    ):
        raise ValueError("Piece minimum quantity must be a whole number")


class ProductCreate(ProductSchema):
    code: RequiredText = Field(max_length=100)
    name: RequiredText = Field(max_length=255)
    size: RequiredText = Field(max_length=100)
    company: RequiredText = Field(max_length=255)
    unit: ProductUnit
    quantity: Quantity = Decimal("0")
    minimum_quantity: Quantity = Decimal("0")
    sell_price_iqd: IqdAmount
    purchase_price_usd: UsdAmount

    @model_validator(mode="after")
    def quantities_match_unit(self) -> "ProductCreate":
        validate_piece_quantities(self.unit, self.quantity, self.minimum_quantity)
        return self


class ProductUpdate(ProductSchema):
    code: RequiredText | None = Field(default=None, max_length=100)
    name: RequiredText | None = Field(default=None, max_length=255)
    size: RequiredText | None = Field(default=None, max_length=100)
    company: RequiredText | None = Field(default=None, max_length=255)
    unit: ProductUnit | None = None
    quantity: Quantity | None = None
    minimum_quantity: Quantity | None = None
    sell_price_iqd: IqdAmount | None = None
    purchase_price_usd: UsdAmount | None = None

    @model_validator(mode="after")
    def supplied_quantities_match_unit(self) -> "ProductUpdate":
        if any(getattr(self, field) is None for field in self.model_fields_set):
            raise ValueError("Supplied product fields cannot be null")
        validate_piece_quantities(self.unit, self.quantity, self.minimum_quantity)
        return self


class ProductRead(ProductSchema):
    id: int
    code: str
    name: str
    size: str
    company: str
    unit: ProductUnit
    quantity: Decimal
    minimum_quantity: Decimal
    sell_price_iqd: Decimal
    purchase_price_usd: Decimal
    created_at: datetime
    updated_at: datetime


class ProductListResponse(ProductSchema):
    items: list[ProductRead]
    total: int
    page: int
    page_size: int
    total_pages: int
