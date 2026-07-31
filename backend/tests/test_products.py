from copy import deepcopy

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def product_payload() -> dict[str, object]:
    return {
        "code": "A1",
        "name": "Ceramic Floor",
        "size": "60x60",
        "company": "Al-Baraa",
        "unit": "متر مربع",
        "quantity": "12.500000",
        "minimumQuantity": "2.000000",
        "sellPriceIqd": "25000",
        "purchasePriceUsd": "8.7500",
    }


def create_product(client: TestClient, payload: dict[str, object]) -> dict[str, object]:
    response = client.post("/api/products", json=payload)
    assert response.status_code == 201, response.text
    return response.json()


def test_create_product_successfully(
    client: TestClient, product_payload: dict[str, object]
) -> None:
    product = create_product(client, product_payload)
    assert product["code"] == "A1"
    assert product["minimumQuantity"] == "2.000000"
    assert product["sellPriceIqd"] == "25000"


def test_create_product_generates_numeric_id(
    client: TestClient, product_payload: dict[str, object]
) -> None:
    product = create_product(client, product_payload)
    assert isinstance(product["id"], int)
    assert product["id"] > 0


def test_list_products(client: TestClient, product_payload: dict[str, object]) -> None:
    created = create_product(client, product_payload)
    response = client.get("/api/products")
    assert response.status_code == 200
    assert response.json()["items"] == [created]


def test_get_product_by_id(
    client: TestClient, product_payload: dict[str, object]
) -> None:
    created = create_product(client, product_payload)
    response = client.get(f"/api/products/{created['id']}")
    assert response.status_code == 200
    assert response.json() == created


def test_search_by_code(client: TestClient, product_payload: dict[str, object]) -> None:
    create_product(client, product_payload)
    response = client.get("/api/products", params={"search": "a1"})
    assert response.json()["total"] == 1


def test_search_by_name(client: TestClient, product_payload: dict[str, object]) -> None:
    create_product(client, product_payload)
    response = client.get("/api/products", params={"search": "floor"})
    assert response.json()["total"] == 1


def test_pagination_metadata(
    client: TestClient, product_payload: dict[str, object]
) -> None:
    for index in range(3):
        payload = deepcopy(product_payload)
        payload["code"] = f"A{index}"
        create_product(client, payload)
    response = client.get("/api/products", params={"page": 2, "pageSize": 2})
    body = response.json()
    assert {key: body[key] for key in ("total", "page", "pageSize", "totalPages")} == {
        "total": 3,
        "page": 2,
        "pageSize": 2,
        "totalPages": 2,
    }
    assert len(body["items"]) == 1


def test_partial_update(client: TestClient, product_payload: dict[str, object]) -> None:
    created = create_product(client, product_payload)
    response = client.patch(
        f"/api/products/{created['id']}", json={"name": "Updated Ceramic"}
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Updated Ceramic"
    assert response.json()["code"] == "A1"


def test_delete_product(client: TestClient, product_payload: dict[str, object]) -> None:
    created = create_product(client, product_payload)
    response = client.delete(f"/api/products/{created['id']}")
    assert response.status_code == 204
    assert client.get(f"/api/products/{created['id']}").status_code == 404


def test_missing_product_returns_structured_404(client: TestClient) -> None:
    response = client.get("/api/products/999")
    assert response.status_code == 404
    assert response.json() == {
        "error": {"code": "product_not_found", "message": "Product not found"}
    }


def test_duplicate_code_rejected(
    client: TestClient, product_payload: dict[str, object]
) -> None:
    create_product(client, product_payload)
    response = client.post("/api/products", json=product_payload)
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "duplicate_product_code"


def test_duplicate_code_differing_only_by_case_rejected(
    client: TestClient, product_payload: dict[str, object]
) -> None:
    create_product(client, product_payload)
    duplicate = deepcopy(product_payload)
    duplicate["code"] = "a1"
    response = client.post("/api/products", json=duplicate)
    assert response.status_code == 409


def test_code_surrounding_whitespace_is_trimmed(
    client: TestClient, product_payload: dict[str, object]
) -> None:
    product_payload["code"] = "  A1  "
    assert create_product(client, product_payload)["code"] == "A1"


@pytest.mark.parametrize("field", ["quantity", "minimumQuantity"])
def test_negative_quantities_rejected(
    client: TestClient, product_payload: dict[str, object], field: str
) -> None:
    product_payload[field] = "-0.1"
    response = client.post("/api/products", json=product_payload)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


@pytest.mark.parametrize("field", ["sellPriceIqd", "purchasePriceUsd"])
def test_negative_prices_rejected(
    client: TestClient, product_payload: dict[str, object], field: str
) -> None:
    product_payload[field] = "-1"
    assert client.post("/api/products", json=product_payload).status_code == 422


def test_fractional_piece_quantity_rejected(
    client: TestClient, product_payload: dict[str, object]
) -> None:
    product_payload.update({"unit": "قطعة", "quantity": "1.5"})
    assert client.post("/api/products", json=product_payload).status_code == 422


def test_decimal_square_meter_quantity_accepted(
    client: TestClient, product_payload: dict[str, object]
) -> None:
    product_payload["quantity"] = "1.234567"
    product = create_product(client, product_payload)
    assert product["quantity"] == "1.234567"


def test_invalid_unit_rejected(
    client: TestClient, product_payload: dict[str, object]
) -> None:
    product_payload["unit"] = "box"
    response = client.post("/api/products", json=product_payload)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


def test_json_uses_western_numeric_id_and_exact_decimal_strings(
    client: TestClient, product_payload: dict[str, object]
) -> None:
    product = create_product(client, product_payload)
    assert isinstance(product["id"], int)
    assert product["quantity"] == "12.500000"
    assert product["purchasePriceUsd"] == "8.7500"
    assert all(character in "0123456789" for character in str(product["id"]))
