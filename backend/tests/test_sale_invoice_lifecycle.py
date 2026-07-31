from datetime import datetime, timezone
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.customer_transaction import CustomerTransaction
from app.models.product import Product
from app.models.sale_invoice import SaleInvoice
from app.models.sale_invoice_item import SaleInvoiceItem
from app.models.stock_movement import StockMovement
from app.services import customer_transaction_service, inventory_service
from tests.test_sale_invoices import (
    create_customer,
    create_draft,
    create_product,
    draft_payload,
)


def complete(client: TestClient, invoice_id: int):
    return client.post(f"/api/sales/invoices/{invoice_id}/complete")


def cancel(client: TestClient, invoice_id: int, reason: str = "Customer request"):
    return client.post(
        f"/api/sales/invoices/{invoice_id}/cancel", json={"reason": reason}
    )


def test_partial_customer_completion_is_atomic_and_audited(
    client: TestClient, db_session: Session
) -> None:
    product = create_product(client, quantity="20")
    customer = create_customer(client)
    invoice = create_draft(
        client,
        draft_payload(
            product["id"], customer_id=customer["id"], discount="0", paid_amount="5000"
        ),
    )

    response = complete(client, invoice["id"])
    assert response.status_code == 200, response.text
    completed = response.json()
    assert completed["status"] == "completed"
    assert completed["completedAt"] is not None
    assert completed["cancelledAt"] is None
    assert completed["completionTransactionId"] is not None
    assert completed["completionAudit"] == {
        "sourceReference": invoice["invoiceNumber"],
        "stockMovementCount": 1,
        "reversalMovementCount": 0,
        "customerTransactionCreated": True,
        "customerTransactionVoided": False,
    }
    assert client.get(f"/api/products/{product['id']}").json()["quantity"] == "18.000000"

    movement = db_session.scalar(select(StockMovement))
    assert (movement.movement_type, movement.previous_quantity, movement.new_quantity) == (
        "out",
        Decimal("20.000000"),
        Decimal("18.000000"),
    )
    assert (movement.source_type, movement.source_id, movement.source_reference) == (
        "sale_invoice",
        invoice["id"],
        invoice["invoiceNumber"],
    )
    transaction = db_session.get(CustomerTransaction, completed["completionTransactionId"])
    assert (transaction.transaction_type, transaction.amount, transaction.currency) == (
        "debt",
        Decimal("15000.000000"),
        "IQD",
    )
    assert transaction.source_type == "sale_invoice" and transaction.source_id == invoice["id"]
    balance = client.get(f"/api/customers/{customer['id']}/balances").json()
    assert balance["IQD"]["balance"] == "15000.000000"


def test_multiple_products_and_decimal_quantities_complete(client: TestClient) -> None:
    piece = create_product(client, code="LIFE-P", unit="قطعة", quantity="8")
    square = create_product(client, code="LIFE-S", quantity="9.5")
    customer = create_customer(client)
    payload = draft_payload(
        piece["id"], customer_id=customer["id"], quantity="3", discount="0", paid_amount="0"
    )
    payload["items"].append(
        {"productId": square["id"], "quantity": "2.25", "unitPrice": "10000"}
    )
    invoice = create_draft(client, payload)
    assert complete(client, invoice["id"]).status_code == 200
    assert client.get(f"/api/products/{piece['id']}").json()["quantity"] == "5.000000"
    assert client.get(f"/api/products/{square['id']}").json()["quantity"] == "7.250000"


@pytest.mark.parametrize(
    ("paid", "expected_type", "expected_amount"),
    [("20000", None, None), ("25000", "credit", "5000.000000")],
)
def test_paid_and_overpaid_customer_rules(
    client: TestClient, db_session: Session, paid: str, expected_type: str | None, expected_amount: str | None
) -> None:
    product = create_product(client)
    customer = create_customer(client)
    invoice = create_draft(
        client,
        draft_payload(product["id"], customer_id=customer["id"], discount="0", paid_amount=paid),
    )
    result = complete(client, invoice["id"]).json()
    assert result["completionAudit"]["customerTransactionCreated"] is (expected_type is not None)
    transactions = list(db_session.scalars(select(CustomerTransaction)).all())
    if expected_type is None:
        assert transactions == []
    else:
        assert transactions[0].transaction_type == expected_type
        assert str(transactions[0].amount) == expected_amount


def test_usd_completion_stays_usd(client: TestClient, db_session: Session) -> None:
    product = create_product(client)
    customer = create_customer(client)
    invoice = create_draft(
        client,
        draft_payload(
            product["id"], customer_id=customer["id"], currency="USD",
            unit_price="10.25", discount="0", paid_amount="5.50",
        ),
    )
    assert complete(client, invoice["id"]).status_code == 200
    transaction = db_session.scalar(select(CustomerTransaction))
    assert transaction.currency == "USD" and transaction.amount == Decimal("15.000000")


def test_cash_sale_rules_and_duplicate_completion(client: TestClient, db_session: Session) -> None:
    product = create_product(client)
    unpaid = create_draft(
        client, draft_payload(product["id"], discount="0", paid_amount="1")
    )
    rejected = complete(client, unpaid["id"])
    assert rejected.status_code == 409
    assert rejected.json()["error"]["code"] == "cash_sale_unpaid_balance"
    assert client.get(f"/api/products/{product['id']}").json()["quantity"] == "20.000000"
    assert db_session.scalar(select(func.count()).select_from(StockMovement)) == 0

    paid = create_draft(
        client, draft_payload(product["id"], discount="0", paid_amount="25000")
    )
    assert complete(client, paid["id"]).status_code == 200
    duplicate = complete(client, paid["id"])
    assert duplicate.status_code == 409
    assert duplicate.json()["error"]["code"] == "sale_invoice_already_completed"
    assert db_session.scalar(select(func.count()).select_from(StockMovement)) == 1
    assert db_session.scalar(select(func.count()).select_from(CustomerTransaction)) == 0


def test_completion_revalidates_stock_and_unit_without_side_effects(
    client: TestClient, db_session: Session
) -> None:
    product = create_product(client, quantity="5")
    customer = create_customer(client)
    invoice = create_draft(
        client, draft_payload(product["id"], customer_id=customer["id"], quantity="4")
    )
    model = db_session.get(Product, product["id"])
    model.quantity = Decimal("2")
    db_session.commit()
    rejected = complete(client, invoice["id"])
    assert rejected.status_code == 409
    details = rejected.json()["error"]["details"]
    assert details["productCode"] == product["code"] and details["availableQuantity"] == "2.000000"
    assert db_session.get(SaleInvoice, invoice["id"]).status == "draft"
    assert db_session.scalar(select(func.count()).select_from(StockMovement)) == 0
    assert db_session.scalar(select(func.count()).select_from(CustomerTransaction)) == 0

    model.unit = "قطعة"
    model.quantity = Decimal("5")
    db_session.commit()
    changed = complete(client, invoice["id"])
    assert changed.status_code == 409
    assert changed.json()["error"]["code"] == "invoice_product_unit_changed"


def test_missing_items_and_product_block_completion(client: TestClient, db_session: Session) -> None:
    product = create_product(client)
    customer = create_customer(client)
    first = create_draft(client, draft_payload(product["id"], customer_id=customer["id"]))
    db_session.query(SaleInvoiceItem).filter_by(invoice_id=first["id"]).delete()
    db_session.commit()
    assert complete(client, first["id"]).json()["error"]["code"] == "malformed_invoice"

    second = create_draft(client, draft_payload(product["id"], customer_id=customer["id"]))
    db_session.delete(db_session.get(Product, product["id"]))
    db_session.commit()
    missing = complete(client, second["id"])
    assert missing.status_code == 409
    assert missing.json()["error"]["details"]["products"][0]["productCodeSnapshot"] == product["code"]


def test_customer_failure_rolls_back_stock_and_invoice(
    client: TestClient, db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    product = create_product(client)
    customer = create_customer(client)
    invoice = create_draft(client, draft_payload(product["id"], customer_id=customer["id"]))

    def fail(*args, **kwargs):
        raise RuntimeError("simulated")

    monkeypatch.setattr(customer_transaction_service, "create_internal_transaction", fail)
    with pytest.raises(RuntimeError):
        complete(client, invoice["id"])
    assert db_session.get(Product, product["id"]).quantity == Decimal("20.000000")
    assert db_session.get(SaleInvoice, invoice["id"]).status == "draft"
    assert db_session.scalar(select(func.count()).select_from(StockMovement)) == 0


def test_movement_failure_rolls_back_all_products(
    client: TestClient, db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    first = create_product(client, code="FAIL-A")
    second = create_product(client, code="FAIL-B")
    customer = create_customer(client)
    payload = draft_payload(first["id"], customer_id=customer["id"])
    payload["items"].append({"productId": second["id"], "quantity": "1", "unitPrice": "10000"})
    invoice = create_draft(client, payload)
    original = inventory_service.create_internal_stock_movement
    calls = 0

    def fail_second(*args, **kwargs):
        nonlocal calls
        calls += 1
        if calls == 2:
            raise RuntimeError("simulated")
        return original(*args, **kwargs)

    monkeypatch.setattr(inventory_service, "create_internal_stock_movement", fail_second)
    with pytest.raises(RuntimeError):
        complete(client, invoice["id"])
    db_session.expire_all()
    assert db_session.get(Product, first["id"]).quantity == Decimal("20.000000")
    assert db_session.get(Product, second["id"]).quantity == Decimal("20.000000")
    assert db_session.scalar(select(func.count()).select_from(StockMovement)) == 0


def test_cancellation_restores_stock_and_voids_exact_transaction(
    client: TestClient, db_session: Session
) -> None:
    product = create_product(client, quantity="7")
    customer = create_customer(client)
    draft = create_draft(
        client,
        draft_payload(product["id"], customer_id=customer["id"], quantity="3", discount="0", paid_amount="10000"),
    )
    completed = complete(client, draft["id"]).json()
    completed_at = completed["completedAt"]
    response = cancel(client, draft["id"], "Returned order")
    assert response.status_code == 200, response.text
    cancelled = response.json()
    assert cancelled["status"] == "cancelled"
    assert cancelled["completedAt"] == completed_at
    assert cancelled["cancelledAt"] is not None
    assert cancelled["cancellationReason"] == "Returned order"
    assert cancelled["reversedCustomerTransactionId"] == completed["completionTransactionId"]
    assert cancelled["completionAudit"]["stockMovementCount"] == 1
    assert cancelled["completionAudit"]["reversalMovementCount"] == 1
    assert cancelled["completionAudit"]["customerTransactionVoided"] is True
    assert client.get(f"/api/products/{product['id']}").json()["quantity"] == "7.000000"
    movements = list(db_session.scalars(select(StockMovement).order_by(StockMovement.id)).all())
    assert [movement.movement_type for movement in movements] == ["out", "in"]
    assert movements[1].source_type == "sale_invoice_cancellation"
    transaction = db_session.get(CustomerTransaction, completed["completionTransactionId"])
    assert transaction.status == "voided" and "Returned order" in transaction.void_reason
    assert client.get(f"/api/customers/{customer['id']}/balances").json()["IQD"]["balance"] == "0.000000"


def test_fully_paid_and_cash_cancellation_need_no_customer_transaction(
    client: TestClient, db_session: Session
) -> None:
    product = create_product(client)
    customer = create_customer(client)
    for customer_id in (customer["id"], None):
        invoice = create_draft(
            client,
            draft_payload(product["id"], customer_id=customer_id, discount="0", paid_amount="20000"),
        )
        assert complete(client, invoice["id"]).status_code == 200
        assert cancel(client, invoice["id"]).status_code == 200
    assert db_session.scalar(select(func.count()).select_from(CustomerTransaction)) == 0
    assert client.get(f"/api/products/{product['id']}").json()["quantity"] == "20.000000"


def test_cancellation_guards_and_no_duplicate_restore(client: TestClient, db_session: Session) -> None:
    product = create_product(client)
    draft = create_draft(client, draft_payload(product["id"], discount="0", paid_amount="20000"))
    assert cancel(client, draft["id"]).status_code == 409
    assert client.post(f"/api/sales/invoices/{draft['id']}/cancel", json={"reason": " "}).status_code == 422
    assert complete(client, draft["id"]).status_code == 200
    assert cancel(client, draft["id"]).status_code == 200
    duplicate = cancel(client, draft["id"])
    assert duplicate.status_code == 409
    assert duplicate.json()["error"]["code"] == "sale_invoice_already_cancelled"
    assert db_session.scalar(select(func.count()).select_from(StockMovement)) == 2


def test_linked_transaction_conflict_rolls_back_cancellation(
    client: TestClient, db_session: Session
) -> None:
    product = create_product(client)
    customer = create_customer(client)
    invoice = create_draft(client, draft_payload(product["id"], customer_id=customer["id"]))
    completed = complete(client, invoice["id"]).json()
    transaction = db_session.get(CustomerTransaction, completed["completionTransactionId"])
    transaction.status = "voided"
    transaction.voided_at = datetime.now(timezone.utc)
    transaction.void_reason = "External conflict"
    db_session.commit()
    rejected = cancel(client, invoice["id"])
    assert rejected.status_code == 409
    assert rejected.json()["error"]["code"] == "invoice_linked_transaction_conflict"
    assert db_session.get(Product, product["id"]).quantity == Decimal("18.000000")
    assert db_session.scalar(select(func.count()).select_from(StockMovement)) == 1


def test_missing_product_blocks_cancellation_without_partial_restore(
    client: TestClient, db_session: Session
) -> None:
    product = create_product(client)
    invoice = create_draft(client, draft_payload(product["id"], discount="0", paid_amount="20000"))
    assert complete(client, invoice["id"]).status_code == 200
    db_session.delete(db_session.get(Product, product["id"]))
    db_session.commit()
    rejected = cancel(client, invoice["id"])
    assert rejected.status_code == 409
    assert db_session.get(SaleInvoice, invoice["id"]).status == "completed"
    assert db_session.scalar(
        select(func.count()).select_from(StockMovement).where(
            StockMovement.source_type == "sale_invoice_cancellation"
        )
    ) == 0


def test_sales_summary_counts_currency_and_positive_remaining(client: TestClient) -> None:
    product = create_product(client, quantity="100")
    customer = create_customer(client)
    draft = create_draft(client, draft_payload(product["id"], customer_id=customer["id"]))
    completed = create_draft(client, draft_payload(product["id"], customer_id=customer["id"]))
    cancelled = create_draft(
        client, draft_payload(product["id"], customer_id=customer["id"], paid_amount="20000", discount="0")
    )
    usd = create_draft(
        client,
        draft_payload(product["id"], customer_id=customer["id"], currency="USD", unit_price="2.50", discount="0", paid_amount="8"),
    )
    assert complete(client, completed["id"]).status_code == 200
    assert complete(client, cancelled["id"]).status_code == 200
    assert cancel(client, cancelled["id"]).status_code == 200
    assert complete(client, usd["id"]).status_code == 200

    iqd = client.get("/api/sales/summary", params={"currency": "IQD"}).json()
    assert (iqd["totalInvoiceCount"], iqd["draftInvoiceCount"], iqd["completedInvoiceCount"], iqd["cancelledInvoiceCount"]) == (3, 1, 1, 1)
    assert iqd["completedSalesTotal"] == "19000.000000"
    assert iqd["positiveRemainingTotal"] == "14000.000000"
    usd_summary = client.get("/api/sales/summary", params={"currency": "USD"}).json()
    assert usd_summary["completedSalesTotal"] == "5.000000"
    assert usd_summary["positiveRemainingTotal"] == "0.000000"


def test_missing_invoice_and_serialization(client: TestClient) -> None:
    assert complete(client, 9999).status_code == 404
    assert cancel(client, 9999).status_code == 404
    summary = client.get("/api/sales/summary").json()
    assert summary["currency"] == "IQD"
    assert isinstance(summary["completedSalesTotal"], str)
    assert client.get("/api/sales/summary", params={"currency": "EUR"}).status_code == 422
