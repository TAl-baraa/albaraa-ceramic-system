from copy import deepcopy
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.services.customer_transaction_service import create_internal_transaction


@pytest.fixture
def customer_payload() -> dict[str, str]:
    return {
        "name": "Ahmed Ceramic",
        "phone": "07700000001",
        "address": "Baghdad",
        "notes": "Wholesale customer",
    }


def create_customer(client: TestClient, payload: dict[str, str] | None = None) -> dict:
    response = client.post(
        "/api/customers",
        json=payload
        or {"name": "Ahmed Ceramic", "phone": "07700000001", "address": "", "notes": ""},
    )
    assert response.status_code == 201, response.text
    return response.json()


def add_transaction(
    client: TestClient,
    customer_id: int,
    transaction_type: str = "debt",
    amount: str = "25000",
    currency: str = "IQD",
    note: str = "",
) -> dict:
    response = client.post(
        f"/api/customers/{customer_id}/transactions",
        json={
            "transactionType": transaction_type,
            "amount": amount,
            "currency": currency,
            "note": note,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def balances(client: TestClient, customer_id: int) -> dict:
    response = client.get(f"/api/customers/{customer_id}/balances")
    assert response.status_code == 200, response.text
    return response.json()


def test_create_customer_and_generated_id(
    client: TestClient, customer_payload: dict[str, str]
) -> None:
    customer = create_customer(client, customer_payload)
    assert isinstance(customer["id"], int) and customer["id"] > 0
    assert customer["name"] == "Ahmed Ceramic"
    assert customer["lastPaymentAt"] is None


def test_customer_text_is_trimmed(client: TestClient, customer_payload: dict[str, str]) -> None:
    customer_payload.update({"name": "  Ahmed  ", "address": "  Baghdad  "})
    customer = create_customer(client, customer_payload)
    assert customer["name"] == "Ahmed"
    assert customer["address"] == "Baghdad"


def test_list_search_and_pagination(
    client: TestClient, customer_payload: dict[str, str]
) -> None:
    create_customer(client, customer_payload)
    second = deepcopy(customer_payload)
    second.update({"name": "Zainab Tiles", "phone": "07800000002"})
    create_customer(client, second)
    assert client.get("/api/customers", params={"search": "Zainab"}).json()["total"] == 1
    assert client.get("/api/customers", params={"search": "077000"}).json()["total"] == 1
    page = client.get("/api/customers", params={"page": 2, "pageSize": 1}).json()
    assert (page["total"], page["page"], page["pageSize"], page["totalPages"]) == (2, 2, 1, 2)


def test_partial_update_and_missing_customer(client: TestClient) -> None:
    customer = create_customer(client)
    response = client.patch(f"/api/customers/{customer['id']}", json={"notes": "Updated"})
    assert response.status_code == 200 and response.json()["notes"] == "Updated"
    assert client.get("/api/customers/9999").status_code == 404


@pytest.mark.parametrize("payload", [{"name": ""}, {"name": "   "}, {"name": None}])
def test_blank_or_null_name_rejected(client: TestClient, payload: dict) -> None:
    assert client.post("/api/customers", json=payload).status_code == 422


def test_delete_customer_without_transactions(client: TestClient) -> None:
    customer = create_customer(client)
    assert client.delete(f"/api/customers/{customer['id']}").status_code == 204


def test_delete_customer_with_transactions_rejected(client: TestClient) -> None:
    customer = create_customer(client)
    add_transaction(client, customer["id"])
    response = client.delete(f"/api/customers/{customer['id']}")
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "customer_has_transactions"


@pytest.mark.parametrize(
    ("transaction_type", "currency", "expected_effect"),
    [
        ("debt", "IQD", "25000.000000"),
        ("credit", "USD", "-25000.000000"),
        ("payment_received", "IQD", "-25000.000000"),
        ("payment_paid", "USD", "25000.000000"),
    ],
)
def test_create_each_transaction_type(
    client: TestClient, transaction_type: str, currency: str, expected_effect: str
) -> None:
    customer = create_customer(client)
    transaction = add_transaction(client, customer["id"], transaction_type, currency=currency)
    assert transaction["status"] == "active"
    assert transaction["effectAmount"] == expected_effect
    assert transaction["correctedTransactionId"] is None
    assert transaction["createdByCorrection"] is False
    assert transaction["sourceType"] == "manual"


@pytest.mark.parametrize(
    "field,value",
    [
        ("transactionType", "adjustment"),
        ("transactionType", "unknown"),
        ("currency", "EUR"),
        ("amount", "0"),
        ("amount", "-1"),
    ],
)
def test_invalid_transaction_input_rejected(
    client: TestClient, field: str, value: str
) -> None:
    customer = create_customer(client)
    payload = {"transactionType": "debt", "amount": "10", "currency": "IQD", "note": ""}
    payload[field] = value
    response = client.post(f"/api/customers/{customer['id']}/transactions", json=payload)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


def test_transaction_missing_customer_rejected(client: TestClient) -> None:
    response = client.post(
        "/api/customers/999/transactions",
        json={"transactionType": "debt", "amount": "1", "currency": "IQD"},
    )
    assert response.status_code == 404


def test_balance_replay_and_currency_independence(client: TestClient) -> None:
    customer = create_customer(client)
    customer_id = customer["id"]
    add_transaction(client, customer_id, "debt", "25000", "IQD")
    add_transaction(client, customer_id, "payment_received", "10000", "IQD")
    add_transaction(client, customer_id, "payment_received", "5000", "IQD")
    add_transaction(client, customer_id, "credit", "100", "USD")
    result = balances(client, customer_id)
    assert result["IQD"] == {"balance": "10000.000000", "status": "owes_store"}
    assert result["USD"] == {"balance": "-100.000000", "status": "store_owes"}


def test_payment_paid_increases_balance(client: TestClient) -> None:
    customer = create_customer(client)
    add_transaction(client, customer["id"], "payment_paid", "75", "USD")
    assert balances(client, customer["id"])["USD"]["balance"] == "75.000000"


@pytest.mark.parametrize(
    ("transactions", "status"),
    [([], "settled"), (["debt"], "owes_store"), (["credit"], "store_owes")],
)
def test_balance_statuses(client: TestClient, transactions: list[str], status: str) -> None:
    customer = create_customer(client)
    for transaction_type in transactions:
        add_transaction(client, customer["id"], transaction_type, "10", "IQD")
    assert balances(client, customer["id"])["IQD"]["status"] == status


def test_void_recalculates_balance_and_preserves_history(client: TestClient) -> None:
    customer = create_customer(client)
    transaction = add_transaction(client, customer["id"], "debt", "100", "IQD")
    response = client.post(
        f"/api/customers/{customer['id']}/transactions/{transaction['id']}/void",
        json={"reason": "Entered twice"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "voided"
    assert response.json()["voidReason"] == "Entered twice"
    assert balances(client, customer["id"])["IQD"]["balance"] == "0.000000"
    history = client.get(f"/api/customers/{customer['id']}/transactions").json()
    assert history["total"] == 1 and history["items"][0]["effectAmount"] == "0"


def test_void_reason_required_and_duplicate_void_rejected(client: TestClient) -> None:
    customer = create_customer(client)
    transaction = add_transaction(client, customer["id"])
    url = f"/api/customers/{customer['id']}/transactions/{transaction['id']}/void"
    assert client.post(url, json={"reason": " "}).status_code == 422
    assert client.post(url, json={"reason": "Cancel"}).status_code == 200
    assert client.post(url, json={"reason": "Again"}).status_code == 409


def test_voiding_other_customers_transaction_rejected(client: TestClient) -> None:
    first = create_customer(client)
    second = create_customer(client, {"name": "Second", "phone": "0788"})
    transaction = add_transaction(client, first["id"])
    response = client.post(
        f"/api/customers/{second['id']}/transactions/{transaction['id']}/void",
        json={"reason": "Wrong"},
    )
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "transaction_customer_mismatch"


def test_correction_audit_and_balance_exactly_once(client: TestClient) -> None:
    customer = create_customer(client)
    original = add_transaction(client, customer["id"], "debt", "100", "IQD")
    response = client.post(
        f"/api/customers/{customer['id']}/transactions/{original['id']}/correct",
        json={"transactionType": "debt", "amount": "60", "note": "Correct", "reason": "Wrong amount"},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["original"]["status"] == "voided"
    assert body["original"]["voidReason"] == "Wrong amount"
    assert body["replacement"]["status"] == "active"
    assert body["replacement"]["id"] != original["id"]
    assert body["replacement"]["correctedTransactionId"] == original["id"]
    assert body["replacement"]["createdByCorrection"] is True
    assert body["replacement"]["currency"] == "IQD"
    assert body["balances"]["IQD"]["balance"] == "60.000000"


def test_correction_reason_required_and_voided_cannot_be_corrected(client: TestClient) -> None:
    customer = create_customer(client)
    transaction = add_transaction(client, customer["id"])
    url = f"/api/customers/{customer['id']}/transactions/{transaction['id']}/correct"
    payload = {"transactionType": "debt", "amount": "20", "note": "", "reason": ""}
    assert client.post(url, json=payload).status_code == 422
    client.post(
        f"/api/customers/{customer['id']}/transactions/{transaction['id']}/void",
        json={"reason": "Void"},
    )
    payload["reason"] = "Correct"
    assert client.post(url, json=payload).status_code == 409


def test_correcting_other_customers_transaction_rejected(client: TestClient) -> None:
    first = create_customer(client)
    second = create_customer(client, {"name": "Second", "phone": "0788"})
    transaction = add_transaction(client, first["id"])
    response = client.post(
        f"/api/customers/{second['id']}/transactions/{transaction['id']}/correct",
        json={"transactionType": "credit", "amount": "5", "note": "", "reason": "Wrong"},
    )
    assert response.status_code == 409


def test_public_cannot_create_invoice_linked_transaction(client: TestClient) -> None:
    customer = create_customer(client)
    response = client.post(
        f"/api/customers/{customer['id']}/transactions",
        json={
            "transactionType": "debt",
            "amount": "10",
            "currency": "IQD",
            "sourceType": "sale_invoice",
        },
    )
    assert response.status_code == 422


def test_internal_invoice_transaction_and_public_protection(
    client: TestClient, db_session: Session
) -> None:
    customer = create_customer(client)
    transaction = create_internal_transaction(
        db_session,
        customer_id=customer["id"],
        transaction_type="debt",
        amount=Decimal("50"),
        currency="IQD",
        source_type="sale_invoice",
        source_id=99,
        source_reference="INV-99",
    )
    read = client.get(f"/api/customers/{customer['id']}/transactions/{transaction.id}")
    assert read.status_code == 200 and read.json()["sourceType"] == "sale_invoice"
    correction = client.post(
        f"/api/customers/{customer['id']}/transactions/{transaction.id}/correct",
        json={"transactionType": "debt", "amount": "40", "note": "", "reason": "Wrong"},
    )
    void = client.post(
        f"/api/customers/{customer['id']}/transactions/{transaction.id}/void",
        json={"reason": "Wrong"},
    )
    assert correction.status_code == 409 and void.status_code == 409
    assert correction.json()["error"]["code"] == "source_linked_transaction_protected"


def test_history_newest_first_and_running_balance_oldest_first(client: TestClient) -> None:
    customer = create_customer(client)
    first = add_transaction(client, customer["id"], "debt", "100", "IQD")
    second = add_transaction(client, customer["id"], "payment_received", "25", "IQD")
    history = client.get(
        f"/api/customers/{customer['id']}/transactions",
        params={"includeRunningBalance": "true"},
    ).json()["items"]
    assert [item["id"] for item in history] == [second["id"], first["id"]]
    assert history[0]["runningBalance"] == "75.000000"
    assert history[1]["runningBalance"] == "100.000000"


def test_history_filters_and_malformed_date_range(client: TestClient) -> None:
    customer = create_customer(client)
    add_transaction(client, customer["id"], "debt", "10", "IQD")
    add_transaction(client, customer["id"], "credit", "5", "USD")
    history = client.get(
        f"/api/customers/{customer['id']}/transactions", params={"currency": "USD"}
    ).json()
    assert history["total"] == 1 and history["items"][0]["currency"] == "USD"
    response = client.get(
        f"/api/customers/{customer['id']}/transactions",
        params={"dateFrom": "2026-02-01T00:00:00Z", "dateTo": "2026-01-01T00:00:00Z"},
    )
    assert response.status_code == 422 and response.json()["error"]["code"] == "invalid_date_range"


def test_include_balances_and_last_payment(client: TestClient) -> None:
    customer = create_customer(client)
    add_transaction(client, customer["id"], "payment_received", "10", "IQD")
    item = client.get("/api/customers", params={"includeBalances": "true"}).json()["items"][0]
    assert item["balances"]["IQD"]["balance"] == "-10.000000"
    assert item["lastPaymentAt"] is not None


def test_decimal_and_camel_case_serialization(client: TestClient) -> None:
    customer = create_customer(client)
    transaction = add_transaction(client, customer["id"], amount="1.234567")
    assert transaction["amount"] == "1.234567"
    assert "customerId" in transaction and "createdAt" in transaction
    assert "correctedTransactionId" in transaction and "effectAmount" in transaction


def test_duplicate_phone_error_is_safe(client: TestClient) -> None:
    create_customer(client)
    response = client.post("/api/customers", json={"name": "Duplicate", "phone": "07700000001"})
    assert response.status_code == 409
    body = response.json()
    assert body["error"]["code"] == "duplicate_customer_phone"
    assert "sql" not in response.text.lower() and "integrity" not in response.text.lower()
