from datetime import datetime
from decimal import Decimal

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, Index, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class StockMovement(Base):
    __tablename__ = "stock_movements"
    __table_args__ = (
        CheckConstraint("movement_type IN ('in', 'out', 'adjustment')", name="ck_stock_movements_type"),
        CheckConstraint("quantity > 0", name="ck_stock_movements_quantity_positive"),
        CheckConstraint("previous_quantity >= 0", name="ck_stock_movements_previous_nonnegative"),
        CheckConstraint("new_quantity >= 0", name="ck_stock_movements_new_nonnegative"),
        CheckConstraint("length(trim(source_type)) > 0", name="ck_stock_movements_source_required"),
        Index("ix_stock_movements_product_created", "product_id", "created_at", "id"),
        Index("ix_stock_movements_source_lookup", "source_type", "source_id"),
    )

    id: Mapped[int] = mapped_column(
        BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True
    )
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    movement_type: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    quantity: Mapped[Decimal] = mapped_column(Numeric(18, 6), nullable=False)
    previous_quantity: Mapped[Decimal] = mapped_column(Numeric(18, 6), nullable=False)
    new_quantity: Mapped[Decimal] = mapped_column(Numeric(18, 6), nullable=False)
    note: Mapped[str] = mapped_column(Text, nullable=False, default="", server_default="")
    source_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    source_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True, index=True)
    source_reference: Mapped[str] = mapped_column(
        String(255), nullable=False, default="", server_default=""
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
