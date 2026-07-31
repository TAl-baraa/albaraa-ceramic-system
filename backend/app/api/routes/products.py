from math import ceil
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.product import ProductCreate, ProductListResponse, ProductRead, ProductUpdate
from app.services import product_service

router = APIRouter(prefix="/products", tags=["products"])
DatabaseSession = Annotated[Session, Depends(get_db)]


@router.post("", response_model=ProductRead, status_code=status.HTTP_201_CREATED)
def create_product(product_data: ProductCreate, db: DatabaseSession) -> ProductRead:
    return product_service.create_product(db, product_data)


@router.get("", response_model=ProductListResponse)
def list_products(
    db: DatabaseSession,
    search: Annotated[str | None, Query(max_length=255)] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(alias="pageSize", ge=1, le=100)] = 20,
) -> ProductListResponse:
    result = product_service.list_products(
        db, search=search, page=page, page_size=page_size
    )
    return ProductListResponse(
        items=result.items,
        total=result.total,
        page=page,
        page_size=page_size,
        total_pages=ceil(result.total / page_size) if result.total else 0,
    )


@router.get("/{product_id}", response_model=ProductRead)
def get_product(product_id: int, db: DatabaseSession) -> ProductRead:
    return product_service.get_product(db, product_id)


@router.patch("/{product_id}", response_model=ProductRead)
def update_product(
    product_id: int, product_data: ProductUpdate, db: DatabaseSession
) -> ProductRead:
    return product_service.update_product(db, product_id, product_data)


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(product_id: int, db: DatabaseSession) -> Response:
    product_service.delete_product(db, product_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
