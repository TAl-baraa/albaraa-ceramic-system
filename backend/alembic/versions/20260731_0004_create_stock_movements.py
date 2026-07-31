"""Create immutable stock movements.

Revision ID: 20260731_0004
Revises: 20260731_0003
Create Date: 2026-07-31 18:00:00
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260731_0004"
down_revision: str | None = "20260731_0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "stock_movements",
        sa.Column("id", sa.BigInteger(), sa.Identity(), nullable=False),
        sa.Column("product_id", sa.BigInteger(), nullable=False),
        sa.Column("movement_type", sa.String(length=20), nullable=False),
        sa.Column("quantity", sa.Numeric(18, 6), nullable=False),
        sa.Column("previous_quantity", sa.Numeric(18, 6), nullable=False),
        sa.Column("new_quantity", sa.Numeric(18, 6), nullable=False),
        sa.Column("note", sa.Text(), server_default="", nullable=False),
        sa.Column("source_type", sa.String(length=50), nullable=False),
        sa.Column("source_id", sa.BigInteger(), nullable=True),
        sa.Column("source_reference", sa.String(length=255), server_default="", nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.CheckConstraint(
            "movement_type IN ('in', 'out', 'adjustment')", name="ck_stock_movements_type"
        ),
        sa.CheckConstraint("quantity > 0", name="ck_stock_movements_quantity_positive"),
        sa.CheckConstraint(
            "previous_quantity >= 0", name="ck_stock_movements_previous_nonnegative"
        ),
        sa.CheckConstraint("new_quantity >= 0", name="ck_stock_movements_new_nonnegative"),
        sa.CheckConstraint(
            "length(trim(source_type)) > 0", name="ck_stock_movements_source_required"
        ),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_stock_movements_product_created",
        "stock_movements",
        ["product_id", "created_at", "id"],
        unique=False,
    )
    op.create_index(
        "ix_stock_movements_source_lookup",
        "stock_movements",
        ["source_type", "source_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_stock_movements_created_at"), "stock_movements", ["created_at"], unique=False
    )
    op.create_index(
        op.f("ix_stock_movements_movement_type"),
        "stock_movements",
        ["movement_type"],
        unique=False,
    )
    op.create_index(
        op.f("ix_stock_movements_product_id"), "stock_movements", ["product_id"], unique=False
    )
    op.create_index(
        op.f("ix_stock_movements_source_id"), "stock_movements", ["source_id"], unique=False
    )
    op.create_index(
        op.f("ix_stock_movements_source_type"), "stock_movements", ["source_type"], unique=False
    )


def downgrade() -> None:
    op.drop_table("stock_movements")
