from datetime import datetime
from decimal import Decimal

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, Index, Integer, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class SaleInvoiceItem(Base):
    __tablename__ = "sale_invoice_items"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_sale_invoice_items_quantity_positive"),
        CheckConstraint("unit_price > 0", name="ck_sale_invoice_items_price_positive"),
        CheckConstraint("total > 0", name="ck_sale_invoice_items_total_positive"),
        CheckConstraint("unit IN ('متر مربع', 'قطعة')", name="ck_sale_invoice_items_unit"),
        Index("ix_sale_invoice_items_invoice_product", "invoice_id", "product_id"),
    )

    id: Mapped[int] = mapped_column(
        BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True
    )
    invoice_id: Mapped[int] = mapped_column(
        ForeignKey("sale_invoices.id", ondelete="CASCADE"), nullable=False, index=True
    )
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    product_code_snapshot: Mapped[str] = mapped_column(String(100), nullable=False)
    product_name_snapshot: Mapped[str] = mapped_column(String(255), nullable=False)
    unit: Mapped[str] = mapped_column(String(20), nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(18, 6), nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(24, 6), nullable=False)
    total: Mapped[Decimal] = mapped_column(Numeric(24, 6), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    invoice: Mapped["SaleInvoice"] = relationship(back_populates="items")


from app.models.sale_invoice import SaleInvoice  # noqa: E402
