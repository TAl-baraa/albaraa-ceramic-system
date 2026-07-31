from datetime import datetime
from decimal import Decimal

from sqlalchemy import BigInteger, CheckConstraint, DateTime, Index, Integer, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Product(Base):
    __tablename__ = "products"
    __table_args__ = (
        CheckConstraint("unit IN ('متر مربع', 'قطعة')", name="ck_products_unit"),
        CheckConstraint("quantity >= 0", name="ck_products_quantity_nonnegative"),
        CheckConstraint(
            "minimum_quantity >= 0", name="ck_products_minimum_quantity_nonnegative"
        ),
        CheckConstraint(
            "sell_price_iqd >= 0", name="ck_products_sell_price_iqd_nonnegative"
        ),
        CheckConstraint(
            "purchase_price_usd >= 0",
            name="ck_products_purchase_price_usd_nonnegative",
        ),
        CheckConstraint(
            "unit <> 'قطعة' OR (quantity = trunc(quantity) AND "
            "minimum_quantity = trunc(minimum_quantity))",
            name="ck_products_piece_quantities_whole",
        ),
    )

    id: Mapped[int] = mapped_column(
        BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True
    )
    code: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    size: Mapped[str] = mapped_column(String(100), nullable=False)
    company: Mapped[str] = mapped_column(String(255), nullable=False)
    unit: Mapped[str] = mapped_column(String(20), nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(18, 6), nullable=False)
    minimum_quantity: Mapped[Decimal] = mapped_column(Numeric(18, 6), nullable=False)
    sell_price_iqd: Mapped[Decimal] = mapped_column(Numeric(18, 0), nullable=False)
    purchase_price_usd: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


Index("uq_products_code_lower", func.lower(Product.code), unique=True)
