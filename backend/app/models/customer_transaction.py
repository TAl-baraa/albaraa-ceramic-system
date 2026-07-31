from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class CustomerTransaction(Base):
    __tablename__ = "customer_transactions"
    __table_args__ = (
        CheckConstraint(
            "transaction_type IN ('debt', 'credit', 'payment_received', 'payment_paid')",
            name="ck_customer_transactions_type",
        ),
        CheckConstraint("amount > 0", name="ck_customer_transactions_amount_positive"),
        CheckConstraint("currency IN ('IQD', 'USD')", name="ck_customer_transactions_currency"),
        CheckConstraint("status IN ('active', 'voided')", name="ck_customer_transactions_status"),
        CheckConstraint(
            "(status = 'active' AND voided_at IS NULL AND void_reason = '') OR "
            "(status = 'voided' AND voided_at IS NOT NULL AND length(trim(void_reason)) > 0)",
            name="ck_customer_transactions_void_state",
        ),
        CheckConstraint(
            "corrected_transaction_id IS NULL OR corrected_transaction_id <> id",
            name="ck_customer_transactions_not_self_corrected",
        ),
        Index("ix_customer_transactions_customer_created", "customer_id", "created_at", "id"),
    )

    id: Mapped[int] = mapped_column(
        BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True
    )
    customer_id: Mapped[int] = mapped_column(
        ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    transaction_type: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(24, 6), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, index=True)
    note: Mapped[str] = mapped_column(Text, nullable=False, default="", server_default="")
    status: Mapped[str] = mapped_column(String(10), nullable=False, default="active", index=True)
    corrected_transaction_id: Mapped[int | None] = mapped_column(
        ForeignKey("customer_transactions.id", ondelete="RESTRICT"), nullable=True, index=True
    )
    voided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    void_reason: Mapped[str] = mapped_column(Text, nullable=False, default="", server_default="")
    created_by_correction: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    source_type: Mapped[str] = mapped_column(
        String(50), nullable=False, default="manual", server_default="manual", index=True
    )
    source_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True, index=True)
    source_reference: Mapped[str] = mapped_column(
        String(255), nullable=False, default="", server_default=""
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
