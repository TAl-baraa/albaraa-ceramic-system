import assert from "node:assert/strict";
import test from "node:test";

import type { StockMovementDto } from "../src/api/inventory/inventoryApiTypes.ts";
import {
    InventoryMappingError,
    inventorySummaryDtoToDomain,
    lowStockProductDtoToDomain,
    stockAdjustmentInputToDto,
    stockInInputToDto,
    stockMovementDtoToDomain,
    stockOutInputToDto,
} from "../src/api/inventory/inventoryMappers.ts";

function movementDto(
    movementType: StockMovementDto["movementType"] = "in",
    productUnit: StockMovementDto["productUnit"] = "متر مربع",
): StockMovementDto {
    return {
        id: 1,
        productId: 2,
        movementType,
        quantity: "2.500000",
        previousQuantity: "10.000000",
        newQuantity: movementType === "out" ? "7.500000" : "12.500000",
        note: " Movement ",
        sourceType: "sale_invoice",
        sourceId: 5,
        sourceReference: " INV-2026-0005 ",
        createdAt: "2026-07-31T10:00:00Z",
        productCode: " A1 ",
        productName: " Ceramic A1 ",
        productUnit,
    };
}

test("maps stock-in, stock-out, and adjustment snapshots with source audit", () => {
    for (const type of ["in", "out", "adjustment"] as const) {
        const mapped = stockMovementDtoToDomain(movementDto(type));
        assert.equal(mapped.type, type);
        assert.equal(mapped.quantity, 2.5);
        assert.equal(mapped.productCode, "A1");
        assert.equal(mapped.productName, "Ceramic A1");
        assert.equal(mapped.productUnit, "متر مربع");
        assert.equal(mapped.sourceType, "sale_invoice");
        assert.equal(mapped.sourceId, 5);
        assert.equal(mapped.sourceReference, "INV-2026-0005");
    }
});

test("strict movement parsing rejects malformed, unsafe, fractional-piece, and invalid dates", () => {
    assert.throws(
        () => stockMovementDtoToDomain({ ...movementDto(), quantity: "2,5" }),
        InventoryMappingError,
    );
    assert.throws(
        () => stockMovementDtoToDomain({ ...movementDto(), quantity: "9007199254740992" }),
        InventoryMappingError,
    );
    assert.throws(
        () => stockMovementDtoToDomain(movementDto("in", "قطعة")),
        /whole numbers/,
    );
    assert.equal(stockMovementDtoToDomain(movementDto()).quantity, 2.5);
    assert.throws(
        () => stockMovementDtoToDomain({ ...movementDto(), createdAt: "not-a-date" }),
        /timestamp/,
    );
});

test("maps empty and populated inventory summaries exactly", () => {
    const empty = inventorySummaryDtoToDomain({
        totalProducts: 0,
        totalSquareMeters: "0.000000",
        totalPieces: "0.000000",
        lowStockCount: 0,
        outOfStockCount: 0,
        totalSaleValueIqd: "0.000000",
        totalPurchaseValueUsd: "0.000000",
    });
    assert.deepEqual(empty, {
        totalProducts: 0,
        totalSquareMeters: 0,
        totalPieces: 0,
        lowStockCount: 0,
        outOfStockCount: 0,
        totalSaleValueIqd: 0,
        totalPurchaseValueUsd: 0,
    });
    const populated = inventorySummaryDtoToDomain({
        totalProducts: 2,
        totalSquareMeters: "12.500000",
        totalPieces: "8.000000",
        lowStockCount: 1,
        outOfStockCount: 1,
        totalSaleValueIqd: "250000.000000",
        totalPurchaseValueUsd: "87.500000",
    });
    assert.equal(populated.totalSquareMeters, 12.5);
    assert.equal(populated.totalPieces, 8);
    assert.equal(populated.totalSaleValueIqd, 250000);
    assert.equal(populated.totalPurchaseValueUsd, 87.5);
    assert.throws(
        () => inventorySummaryDtoToDomain({
            totalProducts: 0, totalSquareMeters: "NaN", totalPieces: "0",
            lowStockCount: 0, outOfStockCount: 0,
            totalSaleValueIqd: "0", totalPurchaseValueUsd: "0",
        }),
        InventoryMappingError,
    );
});

test("maps low-stock and out-of-stock products with IDs and Arabic units", () => {
    const low = lowStockProductDtoToDomain({
        productId: 2, code: "A", name: "A", quantity: "2.500000",
        minimumQuantity: "3.000000", unit: "متر مربع", status: "low_stock",
    });
    const out = lowStockProductDtoToDomain({
        productId: 3, code: "B", name: "B", quantity: "0.000000",
        minimumQuantity: "2.000000", unit: "قطعة", status: "out_of_stock",
    });
    assert.deepEqual([low.status, out.status], ["low_stock", "out_of_stock"]);
    assert.equal(low.productId, 2);
    assert.equal(out.unit, "قطعة");
});

test("request mapping validates quantities and excludes backend audit fields", () => {
    const inputWithAudit = {
        productId: 2,
        quantity: 3,
        note: " Delivery ",
        unit: "قطعة" as const,
        sourceType: "sale_invoice",
        previousQuantity: 10,
    };
    assert.deepEqual(stockInInputToDto(inputWithAudit), {
        productId: 2, quantity: "3", note: "Delivery",
    });
    assert.deepEqual(stockOutInputToDto(inputWithAudit), {
        productId: 2, quantity: "3", note: "Delivery",
    });
    assert.deepEqual(
        stockAdjustmentInputToDto({
            productId: 2, finalQuantity: 4, note: " Count ", unit: "قطعة",
        }),
        { productId: 2, finalQuantity: "4", note: "Count" },
    );
    assert.throws(() => stockInInputToDto({ productId: 2, quantity: 0, note: "" }), /greater than zero/);
    assert.throws(
        () => stockAdjustmentInputToDto({ productId: 2, finalQuantity: 4, note: " " }),
        /note is required/,
    );
});
