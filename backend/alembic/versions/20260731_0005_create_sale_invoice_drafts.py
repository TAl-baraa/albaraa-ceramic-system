"""Create sale invoice drafts and items.

Revision ID: 20260731_0005
Revises: 20260731_0004
Create Date: 2026-07-31 19:00:00
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260731_0005"
down_revision: str | None = "20260731_0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "invoice_sequences",
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("last_value", sa.BigInteger(), nullable=False),
        sa.PrimaryKeyConstraint("year"),
    )
    op.create_table(
        "sale_invoices",
        sa.Column("id", sa.BigInteger(), sa.Identity(), nullable=False),
        sa.Column("invoice_number", sa.String(length=50), nullable=False),
        sa.Column("customer_id", sa.BigInteger(), nullable=True),
        sa.Column("customer_name_snapshot", sa.String(length=255), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("status", sa.String(length=12), nullable=False),
        sa.Column("subtotal", sa.Numeric(24, 6), nullable=False),
        sa.Column("discount", sa.Numeric(24, 6), nullable=False),
        sa.Column("total", sa.Numeric(24, 6), nullable=False),
        sa.Column("paid_amount", sa.Numeric(24, 6), nullable=False),
        sa.Column("remaining_amount", sa.Numeric(24, 6), nullable=False),
        sa.Column("note", sa.Text(), server_default="", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancellation_reason", sa.Text(), server_default="", nullable=False),
        sa.Column("completion_transaction_id", sa.BigInteger(), nullable=True),
        sa.Column("reversed_customer_transaction_id", sa.BigInteger(), nullable=True),
        sa.CheckConstraint("length(trim(invoice_number)) > 0", name="ck_sale_invoices_number_nonblank"),
        sa.CheckConstraint("currency IN ('IQD', 'USD')", name="ck_sale_invoices_currency"),
        sa.CheckConstraint("status IN ('draft', 'completed', 'cancelled')", name="ck_sale_invoices_status"),
        sa.CheckConstraint("subtotal >= 0", name="ck_sale_invoices_subtotal_nonnegative"),
        sa.CheckConstraint("discount >= 0", name="ck_sale_invoices_discount_nonnegative"),
        sa.CheckConstraint("total >= 0", name="ck_sale_invoices_total_nonnegative"),
        sa.CheckConstraint("paid_amount >= 0", name="ck_sale_invoices_paid_nonnegative"),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_sale_invoices_created_id", "sale_invoices", ["created_at", "id"])
    op.create_index("ix_sale_invoices_status_currency", "sale_invoices", ["status", "currency"])
    op.create_index(op.f("ix_sale_invoices_currency"), "sale_invoices", ["currency"])
    op.create_index(op.f("ix_sale_invoices_customer_id"), "sale_invoices", ["customer_id"])
    op.create_index(
        op.f("ix_sale_invoices_customer_name_snapshot"),
        "sale_invoices",
        ["customer_name_snapshot"],
    )
    op.create_index(
        op.f("ix_sale_invoices_invoice_number"), "sale_invoices", ["invoice_number"], unique=True
    )
    op.create_index(op.f("ix_sale_invoices_status"), "sale_invoices", ["status"])

    op.create_table(
        "sale_invoice_items",
        sa.Column("id", sa.BigInteger(), sa.Identity(), nullable=False),
        sa.Column("invoice_id", sa.BigInteger(), nullable=False),
        sa.Column("product_id", sa.BigInteger(), nullable=False),
        sa.Column("product_code_snapshot", sa.String(length=100), nullable=False),
        sa.Column("product_name_snapshot", sa.String(length=255), nullable=False),
        sa.Column("unit", sa.String(length=20), nullable=False),
        sa.Column("quantity", sa.Numeric(18, 6), nullable=False),
        sa.Column("unit_price", sa.Numeric(24, 6), nullable=False),
        sa.Column("total", sa.Numeric(24, 6), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("quantity > 0", name="ck_sale_invoice_items_quantity_positive"),
        sa.CheckConstraint("unit_price > 0", name="ck_sale_invoice_items_price_positive"),
        sa.CheckConstraint("total > 0", name="ck_sale_invoice_items_total_positive"),
        sa.CheckConstraint("unit IN ('متر مربع', 'قطعة')", name="ck_sale_invoice_items_unit"),
        sa.ForeignKeyConstraint(["invoice_id"], ["sale_invoices.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_sale_invoice_items_invoice_product", "sale_invoice_items", ["invoice_id", "product_id"]
    )
    op.create_index(op.f("ix_sale_invoice_items_invoice_id"), "sale_invoice_items", ["invoice_id"])
    op.create_index(op.f("ix_sale_invoice_items_product_id"), "sale_invoice_items", ["product_id"])


def downgrade() -> None:
    op.drop_table("sale_invoice_items")
    op.drop_table("sale_invoices")
    op.drop_table("invoice_sequences")
