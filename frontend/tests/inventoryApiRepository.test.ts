import assert from "node:assert/strict";
import test from "node:test";

import { ApiError, type ApiClient, type ApiRequestOptions } from "../src/api/apiClient.ts";
import type { StockMovementDto } from "../src/api/inventory/inventoryApiTypes.ts";
import { ApiInventoryRepository } from "../src/repositories/ApiInventoryRepository.ts";

const movement: StockMovementDto = {
    id: 1, productId: 2, movementType: "in", quantity: "2.000000",
    previousQuantity: "1.000000", newQuantity: "3.000000", note: "",
    sourceType: "manual", sourceId: null, sourceReference: "",
    createdAt: "2026-07-31T10:00:00Z", productCode: "A1",
    productName: "Product", productUnit: "قطعة",
};
type Call = { method: string; path: string; options?: ApiRequestOptions };

function recordingClient(): { client: ApiClient; calls: Call[] } {
    const calls: Call[] = [];
    return {
        calls,
        client: {
            async get<T>(path, options) {
                calls.push({ method: "GET", path, options });
                if (path.endsWith("/summary")) return {
                    totalProducts: 0, totalSquareMeters: "0", totalPieces: "0",
                    lowStockCount: 0, outOfStockCount: 0,
                    totalSaleValueIqd: "0", totalPurchaseValueUsd: "0",
                } as T;
                if (path.endsWith("/low-stock")) return [] as T;
                if (path === "/inventory/movements") {
                    return { items: [movement], total: 1, page: 1, pageSize: 20, totalPages: 1 } as T;
                }
                return movement as T;
            },
            async post<T>(path, options) {
                calls.push({ method: "POST", path, options });
                return movement as T;
            },
            async patch<T>() { return movement as T; },
            async delete() {},
        },
    };
}

test("API repository sends summary, low-stock, detail, filters, dates, and AbortSignal", async () => {
    const mock = recordingClient();
    const repository = new ApiInventoryRepository(mock.client);
    const controller = new AbortController();
    await repository.getSummary({ signal: controller.signal });
    await repository.listLowStock({ includeOutOfStock: false, limit: 25, signal: controller.signal });
    await repository.getMovementById(1, { signal: controller.signal });
    await repository.listMovements({
        productId: 2, movementType: "out", sourceType: "sale_invoice",
        search: " INV-1 ", dateFrom: "2026-07-01", dateTo: "2026-07-31",
        page: 2, pageSize: 10, signal: controller.signal,
    });
    assert.equal(mock.calls[0].path, "/inventory/summary");
    assert.deepEqual(mock.calls[1].options?.query, { includeOutOfStock: false, limit: 25 });
    assert.equal(mock.calls[2].path, "/inventory/movements/1");
    assert.deepEqual(mock.calls[3].options?.query, {
        productId: 2, movementType: "out", sourceType: "sale_invoice", search: "INV-1",
        dateFrom: "2026-07-01", dateTo: "2026-07-31", page: 2, pageSize: 10,
    });
    assert.equal(mock.calls[3].options?.signal, controller.signal);
});

test("API repository sends only public stock-in, stock-out, and adjustment request fields", async () => {
    const mock = recordingClient();
    const repository = new ApiInventoryRepository(mock.client);
    await repository.createStockIn({ productId: 2, quantity: 2, note: " In ", unit: "قطعة" });
    await repository.createStockOut({ productId: 2, quantity: 1, note: " Out ", unit: "قطعة" });
    await repository.createAdjustment({ productId: 2, finalQuantity: 5, note: " Count ", unit: "قطعة" });
    assert.deepEqual(mock.calls.map((call) => call.path), [
        "/inventory/movements/in",
        "/inventory/movements/out",
        "/inventory/movements/adjustment",
    ]);
    assert.deepEqual(mock.calls[0].options?.body, { productId: 2, quantity: "2", note: "In" });
    assert.deepEqual(mock.calls[2].options?.body, { productId: 2, finalQuantity: "5", note: "Count" });
});

test("all-page movement loading terminates and rejects repeated pagination", async () => {
    let call = 0;
    const client: ApiClient = {
        async get<T>() {
            call += 1;
            return {
                items: [{ ...movement, id: call }], total: 2,
                page: call === 1 ? 1 : 2, pageSize: 100, totalPages: 2,
            } as T;
        },
        async post<T>() { return movement as T; },
        async patch<T>() { return movement as T; },
        async delete() {},
    };
    assert.deepEqual(
        (await new ApiInventoryRepository(client).listAllMovements()).map((item) => item.id),
        [1, 2],
    );
    const repeated: ApiClient = {
        ...client,
        async get<T>() {
            return { items: [movement], total: 2, page: 1, pageSize: 100, totalPages: 2 } as T;
        },
    };
    await assert.rejects(
        new ApiInventoryRepository(repeated).listAllMovements(),
        (error: unknown) => error instanceof ApiError && error.code === "invalid_movement_pagination",
    );
});
