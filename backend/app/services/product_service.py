from dataclasses import dataclass

from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from pydantic import ValidationError

from app.core.errors import (
    DuplicateProductCodeError,
    ProductNotFoundError,
    ProductValidationError,
    ProductHasStockMovementsError,
    ProductQuantityUpdateBlockedError,
)
from app.models.product import Product
from app.models.stock_movement import StockMovement
from app.schemas.product import ProductCreate, ProductUpdate


@dataclass(frozen=True)
class ProductPage:
    items: list[Product]
    total: int


def _normalized_code(code: str) -> str:
    return code.strip()


def _ensure_unique_code(
    db: Session, code: str, *, excluding_product_id: int | None = None
) -> None:
    statement = select(Product.id).where(func.lower(Product.code) == code.lower())
    if excluding_product_id is not None:
        statement = statement.where(Product.id != excluding_product_id)
    if db.scalar(statement) is not None:
        raise DuplicateProductCodeError()


def _commit(db: Session) -> None:
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise DuplicateProductCodeError() from exc


def create_product(db: Session, product_data: ProductCreate) -> Product:
    values = product_data.model_dump()
    values["code"] = _normalized_code(values["code"])
    _ensure_unique_code(db, values["code"])

    product = Product(**values)
    db.add(product)
    _commit(db)
    db.refresh(product)
    return product


def list_products(
    db: Session, *, search: str | None, page: int, page_size: int
) -> ProductPage:
    filters = []
    if search and (term := search.strip()):
        pattern = f"%{term}%"
        filters.append(or_(Product.code.ilike(pattern), Product.name.ilike(pattern)))

    count_statement = select(func.count()).select_from(Product).where(*filters)
    total = db.scalar(count_statement) or 0
    statement = (
        select(Product)
        .where(*filters)
        .order_by(Product.id.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return ProductPage(items=list(db.scalars(statement).all()), total=total)


def get_product(db: Session, product_id: int) -> Product:
    product = db.get(Product, product_id)
    if product is None:
        raise ProductNotFoundError()
    return product


def update_product(db: Session, product_id: int, product_data: ProductUpdate) -> Product:
    product = get_product(db, product_id)
    if "quantity" in product_data.model_fields_set:
        raise ProductQuantityUpdateBlockedError()
    changes = product_data.model_dump(exclude_unset=True)
    if not changes:
        return product
    if "code" in changes:
        changes["code"] = _normalized_code(changes["code"])
        _ensure_unique_code(db, changes["code"], excluding_product_id=product_id)

    merged = {
        "code": product.code,
        "name": product.name,
        "size": product.size,
        "company": product.company,
        "unit": product.unit,
        "quantity": product.quantity,
        "minimum_quantity": product.minimum_quantity,
        "sell_price_iqd": product.sell_price_iqd,
        "purchase_price_usd": product.purchase_price_usd,
        **changes,
    }
    try:
        validated = ProductCreate.model_validate(merged)
    except ValidationError as exc:
        raise ProductValidationError(
            "Updated quantities are incompatible with the selected unit"
        ) from exc
    for field, value in validated.model_dump().items():
        if field in changes:
            setattr(product, field, value)

    _commit(db)
    db.refresh(product)
    return product


def delete_product(db: Session, product_id: int) -> None:
    """Physically delete only products without immutable stock history."""
    product = get_product(db, product_id)
    has_movements = db.scalar(
        select(StockMovement.id).where(StockMovement.product_id == product_id).limit(1)
    )
    if has_movements is not None:
        raise ProductHasStockMovementsError()
    db.delete(product)
    _commit(db)
