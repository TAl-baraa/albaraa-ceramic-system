from copy import deepcopy
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import UnsupportedStockSourceError
from app.models.product import Product
from app.models.stock_movement import StockMovement
from app.services.inventory_service import create_internal_stock_movement


def product_payload(
    *, code: str = "INV-1", unit: str = "متر مربع", quantity: str = "10.000000",
    minimum: str = "3.000000", sale_price: str = "20000", purchase_price: str = "5.5000",
) -> dict[str, object]:
    return {
        "code": code,
        "name": f"Product {code}",
        "size": "60x60",
        "company": "Inventory Company",
        "unit": unit,
        "quantity": quantity,
        "minimumQuantity": minimum,
        "sellPriceIqd": sale_price,
        "purchasePriceUsd": purchase_price,
    }


def create_product(client: TestClient, **kwargs: str) -> dict:
    response = client.post("/api/products", json=product_payload(**kwargs))
    assert response.status_code == 201, response.text
    return response.json()


def move(client: TestClient, kind: str, payload: dict[str, object]) -> object:
    return client.post(f"/api/inventory/movements/{kind}", json=payload)


def get_product(client: TestClient, product_id: int) -> dict:
    response = client.get(f"/api/products/{product_id}")
    assert response.status_code == 200
    return response.json()


def test_stock_in_increases_quantity_and_records_audit(client: TestClient) -> None:
    product = create_product(client)
    response = move(
        client, "in", {"productId": product["id"], "quantity": "2.500000", "note": "Delivery"}
    )
    assert response.status_code == 201, response.text
    movement = response.json()
    assert movement["movementType"] == "in"
    assert movement["previousQuantity"] == "10.000000"
    assert movement["newQuantity"] == "12.500000"
    assert movement["quantity"] == "2.500000"
    assert movement["sourceType"] == "manual"
    assert get_product(client, product["id"])["quantity"] == "12.500000"
    assert client.get("/api/inventory/movements").json()["total"] == 1


def test_piece_stock_in_rejects_decimal_and_square_meter_accepts_it(client: TestClient) -> None:
    piece = create_product(client, code="PIECE", unit="قطعة", quantity="10", minimum="2")
    rejected = move(client, "in", {"productId": piece["id"], "quantity": "1.5"})
    assert rejected.status_code == 422
    assert rejected.json()["error"]["code"] == "invalid_piece_quantity"
    square = create_product(client, code="SQM")
    assert move(client, "in", {"productId": square["id"], "quantity": "1.125"}).status_code == 201


def test_stock_out_decreases_and_exact_zero_succeeds(client: TestClient) -> None:
    product = create_product(client)
    first = move(client, "out", {"productId": product["id"], "quantity": "4"})
    assert first.status_code == 201
    assert first.json()["newQuantity"] == "6.000000"
    second = move(client, "out", {"productId": product["id"], "quantity": "6"})
    assert second.status_code == 201
    assert get_product(client, product["id"])["quantity"] == "0.000000"


def test_insufficient_stock_is_structured_and_atomic(client: TestClient) -> None:
    product = create_product(client)
    response = move(client, "out", {"productId": product["id"], "quantity": "11"})
    assert response.status_code == 409
    error = response.json()["error"]
    assert error["code"] == "insufficient_stock"
    assert error["details"] == {
        "productId": product["id"],
        "productCode": "INV-1",
        "requestedQuantity": "11",
        "availableQuantity": "10.000000",
        "unit": "متر مربع",
    }
    assert get_product(client, product["id"])["quantity"] == "10.000000"
    assert client.get("/api/inventory/movements").json()["total"] == 0
    assert "sql" not in response.text.lower()


@pytest.mark.parametrize("quantity", ["0", "-1"])
def test_nonpositive_in_out_quantity_rejected(client: TestClient, quantity: str) -> None:
    product = create_product(client)
    assert move(client, "in", {"productId": product["id"], "quantity": quantity}).status_code == 422
    assert move(client, "out", {"productId": product["id"], "quantity": quantity}).status_code == 422


def test_adjustment_sets_final_and_stores_absolute_difference(client: TestClient) -> None:
    product = create_product(client)
    response = move(
        client,
        "adjustment",
        {"productId": product["id"], "finalQuantity": "4.250000", "note": "Physical count"},
    )
    assert response.status_code == 201, response.text
    movement = response.json()
    assert movement["quantity"] == "5.750000"
    assert movement["previousQuantity"] == "10.000000"
    assert movement["newQuantity"] == "4.250000"
    assert get_product(client, product["id"])["quantity"] == "4.250000"


def test_adjustment_validation(client: TestClient) -> None:
    product = create_product(client)
    base = {"productId": product["id"], "finalQuantity": "5"}
    assert move(client, "adjustment", base).status_code == 422
    assert move(client, "adjustment", {**base, "note": "Count", "finalQuantity": "10"}).status_code == 409
    assert move(client, "adjustment", {**base, "note": "Count", "finalQuantity": "-1"}).status_code == 422


def test_adjustment_unit_precision(client: TestClient) -> None:
    piece = create_product(client, code="P", unit="قطعة", quantity="10", minimum="2")
    rejected = move(
        client, "adjustment", {"productId": piece["id"], "finalQuantity": "2.5", "note": "Count"}
    )
    assert rejected.status_code == 422
    square = create_product(client, code="S")
    accepted = move(
        client, "adjustment", {"productId": square["id"], "finalQuantity": "2.5", "note": "Count"}
    )
    assert accepted.status_code == 201


def test_history_newest_first_filters_search_and_pagination(
    client: TestClient, db_session: Session
) -> None:
    first_product = create_product(client, code="SEARCH-CODE")
    second_product = create_product(client, code="SECOND")
    first = move(client, "in", {"productId": first_product["id"], "quantity": "1", "note": "Alpha"}).json()
    second = move(client, "out", {"productId": first_product["id"], "quantity": "1", "note": "Beta"}).json()
    internal = create_internal_stock_movement(
        db_session,
        product_id=second_product["id"],
        movement_type="in",
        quantity=Decimal("2"),
        source_type="sale_invoice_cancellation",
        source_id=50,
        source_reference="INV-50",
        note="Reversal",
    )
    db_session.commit()
    history = client.get("/api/inventory/movements").json()
    assert [item["id"] for item in history["items"]] == [internal.id, second["id"], first["id"]]
    assert client.get("/api/inventory/movements", params={"productId": first_product["id"]}).json()["total"] == 2
    assert client.get("/api/inventory/movements", params={"movementType": "out"}).json()["total"] == 1
    assert client.get("/api/inventory/movements", params={"sourceType": "sale_invoice_cancellation"}).json()["total"] == 1
    assert client.get("/api/inventory/movements", params={"search": "search-code"}).json()["total"] == 2
    assert client.get("/api/inventory/movements", params={"search": "INV-50"}).json()["total"] == 1
    page = client.get("/api/inventory/movements", params={"page": 2, "pageSize": 2}).json()
    assert (page["total"], page["page"], page["pageSize"], page["totalPages"], len(page["items"])) == (3, 2, 2, 2, 1)


def test_movement_details_readable_fields_immutable_and_missing(client: TestClient) -> None:
    product = create_product(client)
    movement = move(client, "in", {"productId": product["id"], "quantity": "1"}).json()
    detail = client.get(f"/api/inventory/movements/{movement['id']}")
    assert detail.status_code == 200
    assert detail.json()["productCode"] == "INV-1"
    assert detail.json()["productName"] == "Product INV-1"
    assert detail.json()["productUnit"] == "متر مربع"
    assert client.patch(f"/api/inventory/movements/{movement['id']}", json={}).status_code == 405
    assert client.delete(f"/api/inventory/movements/{movement['id']}").status_code == 405
    assert client.get("/api/inventory/movements/9999").status_code == 404


def test_empty_inventory_summary_is_exact_zero(client: TestClient) -> None:
    summary = client.get("/api/inventory/summary").json()
    assert summary == {
        "totalProducts": 0,
        "totalSquareMeters": "0.000000",
        "totalPieces": "0.000000",
        "lowStockCount": 0,
        "outOfStockCount": 0,
        "totalSaleValueIqd": "0.000000",
        "totalPurchaseValueUsd": "0.000000",
    }


def test_inventory_summary_totals_values_and_no_conversion(client: TestClient) -> None:
    create_product(client, code="SQ", quantity="2.500000", minimum="3", sale_price="20000", purchase_price="4.0000")
    create_product(client, code="PC", unit="قطعة", quantity="4", minimum="2", sale_price="1000", purchase_price="1.5000")
    create_product(client, code="OUT", quantity="0", minimum="1", sale_price="99999", purchase_price="99.0000")
    summary = client.get("/api/inventory/summary").json()
    assert summary["totalProducts"] == 3
    assert summary["totalSquareMeters"] == "2.500000"
    assert summary["totalPieces"] == "4.000000"
    assert summary["lowStockCount"] == 1
    assert summary["outOfStockCount"] == 1
    assert summary["totalSaleValueIqd"] == "54000.000000"
    assert summary["totalPurchaseValueUsd"] == "16.0000000000"


def test_low_stock_order_and_include_out_option(client: TestClient) -> None:
    out = create_product(client, code="OUT", quantity="0", minimum="5")
    low_one = create_product(client, code="LOW1", quantity="1", minimum="10")
    low_two = create_product(client, code="LOW2", quantity="5", minimum="10")
    create_product(client, code="OK", quantity="20", minimum="10")
    items = client.get("/api/inventory/low-stock", params={"includeOutOfStock": "true"}).json()
    assert [item["productId"] for item in items] == [out["id"], low_one["id"], low_two["id"]]
    assert items[0]["status"] == "out_of_stock" and items[1]["status"] == "low_stock"
    without_out = client.get("/api/inventory/low-stock", params={"includeOutOfStock": "false"}).json()
    assert all(item["status"] == "low_stock" for item in without_out)


def test_internal_movement_flushes_but_does_not_commit(db_session: Session) -> None:
    product = Product(
        code="INTERNAL", name="Internal", size="1", company="C", unit="متر مربع",
        quantity=Decimal("10"), minimum_quantity=Decimal("1"),
        sell_price_iqd=Decimal("1"), purchase_price_usd=Decimal("1"),
    )
    db_session.add(product)
    db_session.commit()
    movement = create_internal_stock_movement(
        db_session,
        product_id=product.id,
        movement_type="out",
        quantity=Decimal("3"),
        source_type="sale_invoice",
        source_id=7,
        source_reference="INV-7",
    )
    assert movement.id is not None and product.quantity == Decimal("7")
    db_session.rollback()
    db_session.expire_all()
    assert db_session.get(Product, product.id).quantity == Decimal("10.000000")
    assert db_session.scalar(select(func.count()).select_from(StockMovement)) == 0


def test_internal_source_validation(db_session: Session) -> None:
    with pytest.raises(UnsupportedStockSourceError):
        create_internal_stock_movement(
            db_session,
            product_id=1,
            movement_type="in",
            quantity=Decimal("1"),
            source_type="unsupported",
        )


def test_sequential_locked_stock_outs_cannot_go_negative(client: TestClient) -> None:
    product = create_product(client)
    assert move(client, "out", {"productId": product["id"], "quantity": "7"}).status_code == 201
    assert move(client, "out", {"productId": product["id"], "quantity": "5"}).status_code == 409
    assert get_product(client, product["id"])["quantity"] == "3.000000"
    assert client.get("/api/inventory/movements").json()["total"] == 1


def test_product_patch_quantity_blocked_but_minimum_allowed(client: TestClient) -> None:
    product = create_product(client)
    blocked = client.patch(f"/api/products/{product['id']}", json={"quantity": "20"})
    assert blocked.status_code == 409
    assert blocked.json()["error"]["code"] == "product_quantity_update_blocked"
    allowed = client.patch(f"/api/products/{product['id']}", json={"minimumQuantity": "7"})
    assert allowed.status_code == 200
    assert allowed.json()["minimumQuantity"] == "7.000000"


def test_product_deletion_protection(client: TestClient) -> None:
    protected = create_product(client, code="PROTECTED")
    move(client, "in", {"productId": protected["id"], "quantity": "1"})
    response = client.delete(f"/api/products/{protected['id']}")
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "product_has_stock_movements"
    clean = create_product(client, code="CLEAN")
    assert client.delete(f"/api/products/{clean['id']}").status_code == 204


def test_malformed_history_date_range(client: TestClient) -> None:
    response = client.get(
        "/api/inventory/movements",
        params={"dateFrom": "2026-02-01T00:00:00Z", "dateTo": "2026-01-01T00:00:00Z"},
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_date_range"
