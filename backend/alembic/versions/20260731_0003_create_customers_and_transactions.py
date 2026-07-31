"""Create customers and customer financial transactions.

Revision ID: 20260731_0003
Revises: 20260731_0002
Create Date: 2026-07-31 16:30:00
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260731_0003"
down_revision: str | None = "20260731_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "customers",
        sa.Column("id", sa.BigInteger(), sa.Identity(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("phone", sa.String(length=100), server_default="", nullable=False),
        sa.Column("address", sa.Text(), server_default="", nullable=False),
        sa.Column("notes", sa.Text(), server_default="", nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_customers_name"), "customers", ["name"], unique=False)
    op.create_index(
        "uq_customers_phone_nonblank",
        "customers",
        ["phone"],
        unique=True,
        postgresql_where=sa.text("phone <> ''"),
    )

    op.create_table(
        "customer_transactions",
        sa.Column("id", sa.BigInteger(), sa.Identity(), nullable=False),
        sa.Column("customer_id", sa.BigInteger(), nullable=False),
        sa.Column("transaction_type", sa.String(length=30), nullable=False),
        sa.Column("amount", sa.Numeric(24, 6), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("note", sa.Text(), server_default="", nullable=False),
        sa.Column("status", sa.String(length=10), nullable=False),
        sa.Column("corrected_transaction_id", sa.BigInteger(), nullable=True),
        sa.Column("voided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("void_reason", sa.Text(), server_default="", nullable=False),
        sa.Column(
            "created_by_correction", sa.Boolean(), server_default=sa.text("false"), nullable=False
        ),
        sa.Column("source_type", sa.String(length=50), server_default="manual", nullable=False),
        sa.Column("source_id", sa.BigInteger(), nullable=True),
        sa.Column("source_reference", sa.String(length=255), server_default="", nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column(
            "recorded_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.CheckConstraint(
            "transaction_type IN ('debt', 'credit', 'payment_received', 'payment_paid')",
            name="ck_customer_transactions_type",
        ),
        sa.CheckConstraint("amount > 0", name="ck_customer_transactions_amount_positive"),
        sa.CheckConstraint("currency IN ('IQD', 'USD')", name="ck_customer_transactions_currency"),
        sa.CheckConstraint("status IN ('active', 'voided')", name="ck_customer_transactions_status"),
        sa.CheckConstraint(
            "(status = 'active' AND voided_at IS NULL AND void_reason = '') OR "
            "(status = 'voided' AND voided_at IS NOT NULL AND length(trim(void_reason)) > 0)",
            name="ck_customer_transactions_void_state",
        ),
        sa.CheckConstraint(
            "corrected_transaction_id IS NULL OR corrected_transaction_id <> id",
            name="ck_customer_transactions_not_self_corrected",
        ),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(
            ["corrected_transaction_id"], ["customer_transactions.id"], ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_customer_transactions_customer_created",
        "customer_transactions",
        ["customer_id", "created_at", "id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_customer_transactions_corrected_transaction_id"),
        "customer_transactions",
        ["corrected_transaction_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_customer_transactions_currency"),
        "customer_transactions",
        ["currency"],
        unique=False,
    )
    op.create_index(
        op.f("ix_customer_transactions_customer_id"),
        "customer_transactions",
        ["customer_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_customer_transactions_source_id"),
        "customer_transactions",
        ["source_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_customer_transactions_source_type"),
        "customer_transactions",
        ["source_type"],
        unique=False,
    )
    op.create_index(
        op.f("ix_customer_transactions_status"),
        "customer_transactions",
        ["status"],
        unique=False,
    )
    op.create_index(
        op.f("ix_customer_transactions_transaction_type"),
        "customer_transactions",
        ["transaction_type"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_table("customer_transactions")
    op.drop_index("uq_customers_phone_nonblank", table_name="customers")
    op.drop_index(op.f("ix_customers_name"), table_name="customers")
    op.drop_table("customers")
