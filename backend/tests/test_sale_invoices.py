import re
from copy import deepcopy
from datetime import datetime, timezone
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.sale_invoice import SaleInvoice
from app.models.sale_invoice_item import SaleInvoiceItem
from app.models.stock_movement import StockMovement


def product_payload(
    code: str = "SALE-1", unit: str = "متر مربع", quantity: str = "20.000000"
) -> dict[str, object]:
    return {
        "code": code,
        "name": f"Product {code}",
        "size": "60x60",
        "company": "Sales Company",
        "unit": unit,
        "quantity": quantity,
        "minimumQuantity": "2",
        "sellPriceIqd": "10000",
        "purchasePriceUsd": "3.5000",
    }


def create_product(client: TestClient, **kwargs: str) -> dict:
    response = client.post("/api/products", json=product_payload(**kwargs))
    assert response.status_code == 201, response.text
    return response.json()


def create_customer(client: TestClient, name: str = "Invoice Customer") -> dict:
    response = client.post("/api/customers", json={"name": name, "phone": ""})
    assert response.status_code == 201, response.text
    return response.json()


def draft_payload(
    product_id: int,
    *,
    customer_id: int | None = None,
    currency: str = "IQD",
    quantity: str = "2",
    unit_price: str = "10000",
    discount: str = "1000",
    paid_amount: str = "5000",
) -> dict[str, object]:
    return {
        "customerId": customer_id,
        "currency": currency,
        "note": "Draft note",
        "discount": discount,
        "paidAmount": paid_amount,
        "items": [{"productId": product_id, "quantity": quantity, "unitPrice": unit_price}],
    }


def create_draft(client: TestClient, payload: dict[str, object]) -> dict:
    response = client.post("/api/sales/invoices", json=payload)
    assert response.status_code == 201, response.text
    return response.json()


def test_create_cash_and_customer_drafts(client: TestClient) -> None:
    product = create_product(client)
    cash = create_draft(client, draft_payload(product["id"]))
    customer = create_customer(client, "Ali Store")
    selected = create_draft(client, draft_payload(product["id"], customer_id=customer["id"]))
    assert cash["status"] == "draft" and cash["customerId"] is None
    assert cash["customerNameSnapshot"] == "بيع نقدي"
    assert selected["customerId"] == customer["id"]
    assert selected["customerNameSnapshot"] == "Ali Store"


def test_generated_number_format_uniqueness_and_nonreuse(client: TestClient) -> None:
    product = create_product(client)
    first = create_draft(client, draft_payload(product["id"]))
    second = create_draft(client, draft_payload(product["id"]))
    assert re.fullmatch(r"INV-\d{4}-\d{4}", first["invoiceNumber"])
    assert first["invoiceNumber"] != second["invoiceNumber"]
    assert client.delete(f"/api/sales/invoices/{second['id']}").status_code == 204
    third = create_draft(client, draft_payload(product["id"]))
    assert int(third["invoiceNumber"].rsplit("-", 1)[1]) == int(second["invoiceNumber"].rsplit("-", 1)[1]) + 1


def test_snapshots_and_backend_calculations(client: TestClient) -> None:
    product = create_product(client)
    invoice = create_draft(client, draft_payload(product["id"]))
    item = invoice["items"][0]
    assert item["productCodeSnapshot"] == "SALE-1"
    assert item["productNameSnapshot"] == "Product SALE-1"
    assert item["unit"] == "متر مربع"
    assert item["total"] == "20000.000000"
    assert invoice["subtotal"] == "20000.000000"
    assert invoice["discount"] == "1000.000000"
    assert invoice["total"] == "19000.000000"
    assert invoice["paidAmount"] == "5000.000000"
    assert invoice["remainingAmount"] == "14000.000000"


@pytest.mark.parametrize(
    ("paid", "expected"), [("19000", "0.000000"), ("20000", "-1000.000000")]
)
def test_zero_and_negative_remaining_amount(client: TestClient, paid: str, expected: str) -> None:
    product = create_product(client)
    invoice = create_draft(client, draft_payload(product["id"], paid_amount=paid))
    assert invoice["remainingAmount"] == expected


def test_client_totals_and_status_are_rejected(client: TestClient) -> None:
    product = create_product(client)
    payload = draft_payload(product["id"])
    payload.update({"subtotal": "1", "total": "1", "remainingAmount": "1", "status": "completed", "invoiceNumber": "X"})
    response = client.post("/api/sales/invoices", json=payload)
    assert response.status_code == 422


@pytest.mark.parametrize(
    "mutation",
    [
        lambda payload: payload.update(items=[]),
        lambda payload: payload.update(customerId=9999),
        lambda payload: payload.update(currency="EUR"),
        lambda payload: payload.update(discount="-1"),
        lambda payload: payload.update(paidAmount="-1"),
        lambda payload: payload["items"][0].update(productId=9999),
        lambda payload: payload["items"][0].update(quantity="0"),
        lambda payload: payload["items"][0].update(quantity="-1"),
        lambda payload: payload["items"][0].update(unitPrice="0"),
    ],
)
def test_invalid_draft_inputs(client: TestClient, mutation: object) -> None:
    product = create_product(client)
    payload = draft_payload(product["id"])
    mutation(payload)
    assert client.post("/api/sales/invoices", json=payload).status_code in (404, 422)


def test_discount_above_subtotal_rejected(client: TestClient) -> None:
    product = create_product(client)
    response = client.post(
        "/api/sales/invoices", json=draft_payload(product["id"], discount="20001")
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_invoice_discount"


def test_unit_quantity_and_stock_validation(client: TestClient) -> None:
    piece = create_product(client, code="PIECE", unit="قطعة", quantity="5")
    fractional = client.post(
        "/api/sales/invoices", json=draft_payload(piece["id"], quantity="1.5")
    )
    assert fractional.status_code == 422
    exceeded = client.post(
        "/api/sales/invoices", json=draft_payload(piece["id"], quantity="6")
    )
    assert exceeded.status_code == 409
    details = exceeded.json()["error"]["details"]
    assert details["productId"] == piece["id"] and details["availableQuantity"] == "5.000000"
    square = create_product(client, code="SQUARE")
    assert client.post(
        "/api/sales/invoices", json=draft_payload(square["id"], quantity="1.25")
    ).status_code == 201


def test_duplicate_items_merge_or_reject_conflicting_price(client: TestClient) -> None:
    product = create_product(client)
    payload = draft_payload(product["id"])
    payload["items"].append({"productId": product["id"], "quantity": "3", "unitPrice": "10000"})
    merged = create_draft(client, payload)
    assert merged["itemCount"] == 1
    assert merged["items"][0]["quantity"] == "5.000000"
    conflict = draft_payload(product["id"])
    conflict["items"].append({"productId": product["id"], "quantity": "1", "unitPrice": "11000"})
    response = client.post("/api/sales/invoices", json=conflict)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "conflicting_item_price"


def test_iqd_and_usd_price_precision(client: TestClient) -> None:
    product = create_product(client)
    iqd = client.post(
        "/api/sales/invoices", json=draft_payload(product["id"], unit_price="10.5")
    )
    assert iqd.status_code == 422
    usd = client.post(
        "/api/sales/invoices",
        json=draft_payload(
            product["id"], currency="USD", unit_price="10.25", discount="0.25", paid_amount="1.50"
        ),
    )
    assert usd.status_code == 201
    too_precise = client.post(
        "/api/sales/invoices",
        json=draft_payload(product["id"], currency="USD", unit_price="10.251"),
    )
    assert too_precise.status_code == 422


def test_update_preserves_ids_number_replaces_items_and_recalculates(client: TestClient) -> None:
    first = create_product(client, code="FIRST")
    second = create_product(client, code="SECOND")
    invoice = create_draft(client, draft_payload(first["id"]))
    old_item_id = invoice["items"][0]["id"]
    response = client.patch(
        f"/api/sales/invoices/{invoice['id']}",
        json={
            "currency": "USD",
            "discount": "1.00",
            "paidAmount": "2.00",
            "items": [{"productId": second["id"], "quantity": "2.5", "unitPrice": "4.20"}],
        },
    )
    assert response.status_code == 200, response.text
    updated = response.json()
    assert updated["id"] == invoice["id"]
    assert updated["invoiceNumber"] == invoice["invoiceNumber"]
    assert updated["currency"] == "USD"
    assert updated["itemCount"] == 1 and updated["items"][0]["productId"] == second["id"]
    assert updated["items"][0]["id"] != old_item_id
    assert updated["subtotal"] == "10.500000"
    assert updated["total"] == "9.500000"
    assert updated["remainingAmount"] == "7.500000"


def test_update_customer_and_cash_customer(client: TestClient) -> None:
    product = create_product(client)
    first = create_customer(client, "First Customer")
    second = create_customer(client, "Second Customer")
    invoice = create_draft(client, draft_payload(product["id"], customer_id=first["id"]))
    updated = client.patch(
        f"/api/sales/invoices/{invoice['id']}", json={"customerId": second["id"]}
    ).json()
    assert updated["customerId"] == second["id"] and updated["customerNameSnapshot"] == "Second Customer"
    cash = client.patch(f"/api/sales/invoices/{invoice['id']}", json={"customerId": None}).json()
    assert cash["customerId"] is None and cash["customerNameSnapshot"] == "بيع نقدي"


@pytest.mark.parametrize("status_value", ["completed", "cancelled"])
def test_non_draft_cannot_update_or_delete(
    client: TestClient, db_session: Session, status_value: str
) -> None:
    product = create_product(client)
    invoice = create_draft(client, draft_payload(product["id"]))
    model = db_session.get(SaleInvoice, invoice["id"])
    model.status = status_value
    model.completed_at = datetime.now(timezone.utc)
    if status_value == "cancelled":
        model.cancelled_at = datetime.now(timezone.utc)
        model.cancellation_reason = "Test cancellation"
    db_session.commit()
    assert client.patch(f"/api/sales/invoices/{invoice['id']}", json={"note": "X"}).status_code == 409
    assert client.delete(f"/api/sales/invoices/{invoice['id']}").status_code == 409


def test_failed_update_rolls_back_fully(client: TestClient) -> None:
    product = create_product(client)
    invoice = create_draft(client, draft_payload(product["id"]))
    failed = client.patch(
        f"/api/sales/invoices/{invoice['id']}", json={"discount": "999999"}
    )
    assert failed.status_code == 422
    current = client.get(f"/api/sales/invoices/{invoice['id']}").json()
    assert current["discount"] == invoice["discount"]
    assert current["items"] == invoice["items"]


def test_delete_draft_cascades_items_and_missing_returns_404(
    client: TestClient, db_session: Session
) -> None:
    product = create_product(client)
    invoice = create_draft(client, draft_payload(product["id"]))
    assert client.delete(f"/api/sales/invoices/{invoice['id']}").status_code == 204
    assert db_session.scalar(select(func.count()).select_from(SaleInvoiceItem)) == 0
    assert client.get(f"/api/sales/invoices/{invoice['id']}").status_code == 404
    assert client.delete("/api/sales/invoices/9999").status_code == 404


def test_list_order_search_filters_pagination_and_count(
    client: TestClient, db_session: Session
) -> None:
    product = create_product(client)
    customer = create_customer(client, "Search Customer")
    first = create_draft(client, draft_payload(product["id"], customer_id=customer["id"]))
    second_payload = draft_payload(product["id"], currency="USD", unit_price="2.50", discount="0")
    second = create_draft(client, second_payload)
    assert [item["id"] for item in client.get("/api/sales/invoices").json()["items"]] == [second["id"], first["id"]]
    assert client.get("/api/sales/invoices", params={"search": first["invoiceNumber"]}).json()["total"] == 1
    assert client.get("/api/sales/invoices", params={"search": "Search Customer"}).json()["total"] == 1
    assert client.get("/api/sales/invoices", params={"status": "draft"}).json()["total"] == 2
    assert client.get("/api/sales/invoices", params={"currency": "USD"}).json()["total"] == 1
    assert client.get("/api/sales/invoices", params={"customerId": customer["id"]}).json()["total"] == 1
    page = client.get("/api/sales/invoices", params={"page": 2, "pageSize": 1}).json()
    assert (page["total"], page["page"], page["pageSize"], page["totalPages"]) == (2, 2, 1, 2)
    assert all(item["itemCount"] == 1 for item in client.get("/api/sales/invoices").json()["items"])


def test_details_serialization_and_missing(client: TestClient) -> None:
    product = create_product(client)
    invoice = create_draft(client, draft_payload(product["id"]))
    details = client.get(f"/api/sales/invoices/{invoice['id']}")
    assert details.status_code == 200 and len(details.json()["items"]) == 1
    assert isinstance(details.json()["subtotal"], str)
    assert "invoiceNumber" in details.json() and "paidAmount" in details.json()
    assert client.get("/api/sales/invoices/9999").status_code == 404


def test_product_and_customer_snapshots_survive_edits(client: TestClient) -> None:
    product = create_product(client)
    customer = create_customer(client, "Original Customer")
    invoice = create_draft(client, draft_payload(product["id"], customer_id=customer["id"]))
    client.patch(f"/api/products/{product['id']}", json={"name": "Changed Product"})
    client.patch(f"/api/customers/{customer['id']}", json={"name": "Changed Customer"})
    details = client.get(f"/api/sales/invoices/{invoice['id']}").json()
    assert details["items"][0]["productNameSnapshot"] == "Product SALE-1"
    assert details["customerNameSnapshot"] == "Original Customer"


def test_draft_has_no_inventory_or_customer_balance_side_effects(
    client: TestClient, db_session: Session
) -> None:
    product = create_product(client)
    customer = create_customer(client)
    create_draft(client, draft_payload(product["id"], customer_id=customer["id"]))
    assert client.get(f"/api/products/{product['id']}").json()["quantity"] == "20.000000"
    assert db_session.scalar(select(func.count()).select_from(StockMovement)) == 0
    balance = client.get(f"/api/customers/{customer['id']}/balances").json()
    assert balance["IQD"]["balance"] == "0.000000"


def test_duplicate_database_error_not_exposed(client: TestClient) -> None:
    product = create_product(client)
    first = create_draft(client, draft_payload(product["id"]))
    response = client.post(
        "/api/sales/invoices",
        json={**draft_payload(product["id"]), "invoiceNumber": first["invoiceNumber"]},
    )
    assert response.status_code == 422
    assert "sql" not in response.text.lower() and "integrity" not in response.text.lower()
