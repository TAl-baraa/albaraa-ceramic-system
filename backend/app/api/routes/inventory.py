from datetime import datetime
from math import ceil
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.inventory import (
    InventorySummaryRead,
    LowStockProductRead,
    StockAdjustmentRequest,
    StockInRequest,
    StockMovementListResponse,
    StockMovementRead,
    StockOutRequest,
)
from app.services import inventory_service

router = APIRouter(prefix="/inventory", tags=["inventory"])
DatabaseSession = Annotated[Session, Depends(get_db)]


def movement_response(
    item: inventory_service.MovementWithProduct,
) -> StockMovementRead:
    movement = item.movement
    return StockMovementRead.model_validate(
        {
            **{column.name: getattr(movement, column.name) for column in movement.__table__.columns},
            "product_code": item.product.code,
            "product_name": item.product.name,
            "product_unit": item.product.unit,
        }
    )


def created_movement_response(db: Session, movement_id: int) -> StockMovementRead:
    return movement_response(inventory_service.get_stock_movement(db, movement_id))


@router.post(
    "/movements/in", response_model=StockMovementRead, status_code=status.HTTP_201_CREATED
)
def stock_in(data: StockInRequest, db: DatabaseSession) -> StockMovementRead:
    movement = inventory_service.create_stock_in(db, data)
    return created_movement_response(db, movement.id)


@router.post(
    "/movements/out", response_model=StockMovementRead, status_code=status.HTTP_201_CREATED
)
def stock_out(data: StockOutRequest, db: DatabaseSession) -> StockMovementRead:
    movement = inventory_service.create_stock_out(db, data)
    return created_movement_response(db, movement.id)


@router.post(
    "/movements/adjustment",
    response_model=StockMovementRead,
    status_code=status.HTTP_201_CREATED,
)
def stock_adjustment(
    data: StockAdjustmentRequest, db: DatabaseSession
) -> StockMovementRead:
    movement = inventory_service.create_stock_adjustment(db, data)
    return created_movement_response(db, movement.id)


@router.get("/movements", response_model=StockMovementListResponse)
def list_movements(
    db: DatabaseSession,
    product_id: Annotated[int | None, Query(alias="productId", gt=0)] = None,
    movement_type: Annotated[
        Literal["in", "out", "adjustment"] | None, Query(alias="movementType")
    ] = None,
    source_type: Annotated[str | None, Query(alias="sourceType", max_length=50)] = None,
    search: Annotated[str | None, Query(max_length=255)] = None,
    date_from: Annotated[datetime | None, Query(alias="dateFrom")] = None,
    date_to: Annotated[datetime | None, Query(alias="dateTo")] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(alias="pageSize", ge=1, le=100)] = 20,
) -> StockMovementListResponse:
    result = inventory_service.list_stock_movements(
        db,
        product_id=product_id,
        movement_type=movement_type,
        source_type=source_type,
        search=search,
        date_from=date_from,
        date_to=date_to,
        page=page,
        page_size=page_size,
    )
    return StockMovementListResponse(
        items=[movement_response(item) for item in result.items],
        total=result.total,
        page=page,
        page_size=page_size,
        total_pages=ceil(result.total / page_size) if result.total else 0,
    )


@router.get("/movements/{movement_id}", response_model=StockMovementRead)
def get_movement(movement_id: int, db: DatabaseSession) -> StockMovementRead:
    return movement_response(inventory_service.get_stock_movement(db, movement_id))


@router.get("/summary", response_model=InventorySummaryRead)
def inventory_summary(db: DatabaseSession) -> InventorySummaryRead:
    return InventorySummaryRead.model_validate(inventory_service.get_inventory_summary(db))


@router.get("/low-stock", response_model=list[LowStockProductRead])
def low_stock(
    db: DatabaseSession,
    include_out_of_stock: Annotated[bool, Query(alias="includeOutOfStock")] = True,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> list[LowStockProductRead]:
    products = inventory_service.list_low_stock_products(
        db, include_out_of_stock=include_out_of_stock, limit=limit
    )
    return [
        LowStockProductRead(
            product_id=product.id,
            code=product.code,
            name=product.name,
            quantity=product.quantity,
            minimum_quantity=product.minimum_quantity,
            unit=product.unit,
            status="out_of_stock" if product.quantity <= 0 else "low_stock",
        )
        for product in products
    ]
