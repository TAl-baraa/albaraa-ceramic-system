import assert from "node:assert/strict";
import test from "node:test";

import { ApiError } from "../src/api/apiClient.ts";
import { apiErrorToArabic } from "../src/api/apiErrorMessages.ts";
import { ApiInventoryRepository } from "../src/repositories/ApiInventoryRepository.ts";
import { LocalStorageInventoryRepository } from "../src/repositories/LocalStorageInventoryRepository.ts";
import { createInventoryRepository } from "../src/repositories/createInventoryRepository.ts";
import type { StockMovementRecord } from "../src/types/stockMovement.ts";
import { inventoryActivityLabel } from "../src/utils/inventoryActivityLabels.ts";
import { PRODUCTS_STORAGE_KEY } from "../src/utils/productStorage.ts";
import { STOCK_MOVEMENTS_STORAGE_KEY } from "../src/utils/stockMovementStorage.ts";

function storageWithData() {
    const product = {
        id: 1, code: "A1", name: "Tile", size: "60x60", company: "Company",
        unit: "متر مربع", quantity: 10, minimumQuantity: 3,
        sellPriceIqd: 1000, purchasePriceUsd: 2,
    };
    const movement = {
        id: 5, productId: 99, type: "out", quantity: 2,
        previousQuantity: 5, newQuantity: 3, note: "Old movement",
        createdAt: "2026-07-31T10:00:00Z", sourceType: "sale_invoice",
        sourceId: 7, sourceReference: "INV-2026-0007",
    };
    const values = new Map<string, string>([
        [PRODUCTS_STORAGE_KEY, JSON.stringify([product])],
        [STOCK_MOVEMENTS_STORAGE_KEY, JSON.stringify([movement])],
    ]);
    return {
        values,
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => { values.set(key, value); },
    };
}

test("factory selects localStorage or API inventory repository", () => {
    const storage = storageWithData();
    assert.ok(createInventoryRepository(
        { apiBaseUrl: "https://example.test/api", dataSource: "localStorage" }, storage,
    ) instanceof LocalStorageInventoryRepository);
    assert.ok(createInventoryRepository(
        { apiBaseUrl: "https://example.test/api", dataSource: "api" },
    ) instanceof ApiInventoryRepository);
});

test("local repository preserves keys, history, deleted snapshots, and quantity calculations", async () => {
    const storage = storageWithData();
    const repository = new LocalStorageInventoryRepository(storage);
    const deletedMovement = await repository.getMovementById(5);
    assert.equal(deletedMovement.productCode, "INV-2026-0007");
    assert.equal(deletedMovement.productName, "منتج محذوف");
    assert.equal(deletedMovement.productUnit, null);
    const created = await repository.createStockIn({ productId: 1, quantity: 2.5, note: "Delivery" });
    assert.equal(created.newQuantity, 12.5);
    assert.equal((await repository.getSummary()).totalSquareMeters, 12.5);
    assert.ok(storage.values.has(PRODUCTS_STORAGE_KEY));
    assert.ok(storage.values.has(STOCK_MOVEMENTS_STORAGE_KEY));
    assert.equal((await repository.listAllMovements()).length, 2);
});

function movement(overrides: Partial<StockMovementRecord> = {}): StockMovementRecord {
    return {
        id: 1, productId: 1, type: "in", quantity: 50,
        previousQuantity: 50, newQuantity: 100, note: "", createdAt: "2026-07-31T10:00:00Z",
        sourceType: "manual", sourceId: 999, sourceReference: "",
        productCode: "A1", productName: "Tile", productUnit: "متر مربع",
        ...overrides,
    };
}

test("activity labels cover manual, adjustment, invoice, and cancellation without raw IDs", () => {
    assert.equal(inventoryActivityLabel(movement()), "إدخال 50 متر مربع إلى المنتج A1");
    assert.equal(
        inventoryActivityLabel(movement({ type: "out", quantity: 10, productCode: "B2", productUnit: "قطعة" })),
        "إخراج 10 قطع من المنتج B2",
    );
    assert.equal(
        inventoryActivityLabel(movement({ type: "adjustment", previousQuantity: 100, newQuantity: 85 })),
        "تعديل مخزون المنتج A1 من 100 إلى 85",
    );
    assert.equal(
        inventoryActivityLabel(movement({ sourceType: "sale_invoice", sourceReference: "INV-2026-0001" })),
        "بيع بموجب الفاتورة INV-2026-0001",
    );
    assert.equal(
        inventoryActivityLabel(movement({ sourceType: "sale_invoice_cancellation", sourceReference: "INV-2026-0001" })),
        "عكس مخزون بسبب إلغاء الفاتورة INV-2026-0001",
    );
    assert.equal(inventoryActivityLabel(movement()).includes("999"), false);
});

test("Arabic inventory errors are readable while stock details remain structured", () => {
    const insufficient = new ApiError({
        status: 409, code: "insufficient_stock", message: "technical", kind: "conflict",
        details: { productCode: "A1", requestedQuantity: "10", availableQuantity: "2", unit: "قطعة" },
    });
    assert.equal(apiErrorToArabic(insufficient), "الكمية المتوفرة غير كافية.");
    assert.deepEqual(insufficient.details, {
        productCode: "A1", requestedQuantity: "10", availableQuantity: "2", unit: "قطعة",
    });
    const mapped = (code: string) => apiErrorToArabic(
        new ApiError({ status: 409, code, message: "technical", kind: "conflict" }),
    );
    assert.equal(mapped("product_not_found"), "المنتج غير موجود.");
    assert.equal(mapped("stock_movement_not_found"), "حركة المخزون غير موجودة.");
    assert.equal(mapped("adjustment_note_required"), "يجب إدخال سبب تعديل المخزون.");
    assert.equal(mapped("product_quantity_update_blocked"), "يجب تعديل الكمية من خلال حركة مخزون.");
    assert.equal(mapped("product_has_stock_movements"), "لا يمكن حذف المنتج لوجود حركات مخزون مرتبطة به.");
});
