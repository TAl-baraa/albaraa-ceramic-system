from datetime import datetime
from decimal import Decimal

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, Index, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class InvoiceSequence(Base):
    __tablename__ = "invoice_sequences"

    year: Mapped[int] = mapped_column(Integer, primary_key=True)
    last_value: Mapped[int] = mapped_column(BigInteger, nullable=False)


class SaleInvoice(Base):
    __tablename__ = "sale_invoices"
    __table_args__ = (
        CheckConstraint("length(trim(invoice_number)) > 0", name="ck_sale_invoices_number_nonblank"),
        CheckConstraint("currency IN ('IQD', 'USD')", name="ck_sale_invoices_currency"),
        CheckConstraint("status IN ('draft', 'completed', 'cancelled')", name="ck_sale_invoices_status"),
        CheckConstraint("subtotal >= 0", name="ck_sale_invoices_subtotal_nonnegative"),
        CheckConstraint("discount >= 0", name="ck_sale_invoices_discount_nonnegative"),
        CheckConstraint("total >= 0", name="ck_sale_invoices_total_nonnegative"),
        CheckConstraint("paid_amount >= 0", name="ck_sale_invoices_paid_nonnegative"),
        CheckConstraint(
            "(status = 'draft' AND completed_at IS NULL AND cancelled_at IS NULL "
            "AND length(trim(cancellation_reason)) = 0) OR "
            "(status = 'completed' AND completed_at IS NOT NULL AND cancelled_at IS NULL "
            "AND length(trim(cancellation_reason)) = 0) OR "
            "(status = 'cancelled' AND completed_at IS NOT NULL AND cancelled_at IS NOT NULL "
            "AND length(trim(cancellation_reason)) > 0)",
            name="ck_sale_invoices_status_timestamps",
        ),
        Index("ix_sale_invoices_status_currency", "status", "currency"),
        Index("ix_sale_invoices_created_id", "created_at", "id"),
    )

    id: Mapped[int] = mapped_column(
        BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True
    )
    invoice_number: Mapped[str] = mapped_column(String(50), nullable=False, unique=True, index=True)
    customer_id: Mapped[int | None] = mapped_column(
        ForeignKey("customers.id", ondelete="RESTRICT"), nullable=True, index=True
    )
    customer_name_snapshot: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(12), nullable=False, default="draft", index=True)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(24, 6), nullable=False)
    discount: Mapped[Decimal] = mapped_column(Numeric(24, 6), nullable=False)
    total: Mapped[Decimal] = mapped_column(Numeric(24, 6), nullable=False)
    paid_amount: Mapped[Decimal] = mapped_column(Numeric(24, 6), nullable=False)
    remaining_amount: Mapped[Decimal] = mapped_column(Numeric(24, 6), nullable=False)
    note: Mapped[str] = mapped_column(Text, nullable=False, default="", server_default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancellation_reason: Mapped[str] = mapped_column(Text, nullable=False, default="", server_default="")
    completion_transaction_id: Mapped[int | None] = mapped_column(
        ForeignKey("customer_transactions.id", ondelete="RESTRICT"), nullable=True, index=True
    )
    reversed_customer_transaction_id: Mapped[int | None] = mapped_column(
        ForeignKey("customer_transactions.id", ondelete="RESTRICT"), nullable=True, index=True
    )

    items: Mapped[list["SaleInvoiceItem"]] = relationship(
        back_populates="invoice", cascade="all, delete-orphan", passive_deletes=True
    )


from app.models.sale_invoice_item import SaleInvoiceItem  # noqa: E402
