"""Add sale invoice lifecycle audit integrity.

Revision ID: 20260731_0006
Revises: 20260731_0005
Create Date: 2026-07-31 21:00:00
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260731_0006"
down_revision: str | None = "20260731_0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_foreign_key(
        "fk_sale_invoices_completion_tx",
        "sale_invoices",
        "customer_transactions",
        ["completion_transaction_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_foreign_key(
        "fk_sale_invoices_reversed_tx",
        "sale_invoices",
        "customer_transactions",
        ["reversed_customer_transaction_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_index(
        op.f("ix_sale_invoices_completion_transaction_id"),
        "sale_invoices",
        ["completion_transaction_id"],
    )
    op.create_index(
        op.f("ix_sale_invoices_reversed_customer_transaction_id"),
        "sale_invoices",
        ["reversed_customer_transaction_id"],
    )
    op.create_check_constraint(
        "ck_sale_invoices_status_timestamps",
        "sale_invoices",
        "(status = 'draft' AND completed_at IS NULL AND cancelled_at IS NULL "
        "AND length(trim(cancellation_reason)) = 0) OR "
        "(status = 'completed' AND completed_at IS NOT NULL AND cancelled_at IS NULL "
        "AND length(trim(cancellation_reason)) = 0) OR "
        "(status = 'cancelled' AND completed_at IS NOT NULL AND cancelled_at IS NOT NULL "
        "AND length(trim(cancellation_reason)) > 0)",
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_sale_invoices_status_timestamps", "sale_invoices", type_="check"
    )
    op.drop_index(
        op.f("ix_sale_invoices_reversed_customer_transaction_id"),
        table_name="sale_invoices",
    )
    op.drop_index(
        op.f("ix_sale_invoices_completion_transaction_id"),
        table_name="sale_invoices",
    )
    op.drop_constraint(
        "fk_sale_invoices_reversed_tx",
        "sale_invoices",
        type_="foreignkey",
    )
    op.drop_constraint(
        "fk_sale_invoices_completion_tx",
        "sale_invoices",
        type_="foreignkey",
    )
