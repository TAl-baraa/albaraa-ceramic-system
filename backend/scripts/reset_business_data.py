"""Explicit development-only reset of business tables; Alembic history is preserved."""
import argparse
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sqlalchemy import text
from app.core.config import get_settings
from app.db.session import engine

TABLES=("sale_invoice_items","sale_invoices","invoice_sequences","stock_movements","customer_transactions","customers","products")
def main()->int:
    parser=argparse.ArgumentParser(description="Reset development business data")
    parser.add_argument("--confirm-reset",action="store_true")
    args=parser.parse_args()
    settings=get_settings()
    if settings.APP_ENV.lower() in {"production","prod"}:
        print("Refusing to reset business data in production.",file=sys.stderr);return 2
    if not args.confirm_reset:
        print("WARNING: destructive development reset. Re-run with --confirm-reset.",file=sys.stderr);return 2
    with engine.begin() as connection:
        for table in TABLES:
            count=connection.execute(text(f'SELECT count(*) FROM "{table}"')).scalar_one()
            print(f"{table}: {count}")
        connection.execute(text("TRUNCATE TABLE sale_invoice_items, sale_invoices, invoice_sequences, stock_movements, customer_transactions, customers, products RESTART IDENTITY CASCADE"))
    print("Development business data reset complete. Alembic history was preserved.");return 0
if __name__=="__main__":raise SystemExit(main())
