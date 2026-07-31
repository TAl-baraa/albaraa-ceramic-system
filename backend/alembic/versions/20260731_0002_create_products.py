"""Create products table.

Revision ID: 20260731_0002
Revises: 20260731_0001
Create Date: 2026-07-31 00:30:00
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260731_0002"
down_revision: str | None = "20260731_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "products",
        sa.Column("id", sa.BigInteger(), sa.Identity(), nullable=False),
        sa.Column("code", sa.String(length=100), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("size", sa.String(length=100), nullable=False),
        sa.Column("company", sa.String(length=255), nullable=False),
        sa.Column("unit", sa.String(length=20), nullable=False),
        sa.Column("quantity", sa.Numeric(18, 6), nullable=False),
        sa.Column("minimum_quantity", sa.Numeric(18, 6), nullable=False),
        sa.Column("sell_price_iqd", sa.Numeric(18, 0), nullable=False),
        sa.Column("purchase_price_usd", sa.Numeric(18, 4), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("unit IN ('متر مربع', 'قطعة')", name="ck_products_unit"),
        sa.CheckConstraint("quantity >= 0", name="ck_products_quantity_nonnegative"),
        sa.CheckConstraint(
            "minimum_quantity >= 0", name="ck_products_minimum_quantity_nonnegative"
        ),
        sa.CheckConstraint(
            "sell_price_iqd >= 0", name="ck_products_sell_price_iqd_nonnegative"
        ),
        sa.CheckConstraint(
            "purchase_price_usd >= 0",
            name="ck_products_purchase_price_usd_nonnegative",
        ),
        sa.CheckConstraint(
            "unit <> 'قطعة' OR (quantity = trunc(quantity) AND "
            "minimum_quantity = trunc(minimum_quantity))",
            name="ck_products_piece_quantities_whole",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_products_code"), "products", ["code"], unique=False)
    op.create_index(op.f("ix_products_name"), "products", ["name"], unique=False)
    op.create_index(
        "uq_products_code_lower", "products", [sa.text("lower(code)")], unique=True
    )


def downgrade() -> None:
    op.drop_index("uq_products_code_lower", table_name="products")
    op.drop_index(op.f("ix_products_name"), table_name="products")
    op.drop_index(op.f("ix_products_code"), table_name="products")
    op.drop_table("products")
