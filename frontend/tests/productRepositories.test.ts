import assert from "node:assert/strict";
import test from "node:test";

import { ApiError, type ApiClient } from "../src/api/apiClient.ts";
import { apiErrorToArabic } from "../src/api/apiErrorMessages.ts";
import type { ProductDto, ProductListDto } from "../src/api/products/productApiTypes.ts";
import { ProductMappingError } from "../src/api/products/productMappers.ts";
import { ApiProductRepository } from "../src/repositories/ApiProductRepository.ts";
import { LocalStorageProductRepository } from "../src/repositories/LocalStorageProductRepository.ts";
import { createProductRepository } from "../src/repositories/createProductRepository.ts";
import { PRODUCTS_STORAGE_KEY } from "../src/utils/productStorage.ts";

function dto(id: number): ProductDto {
    return {
        id,
        code: `P-${id}`,
        name: `Product ${id}`,
        size: "60x60",
        company: "Company",
        unit: "متر مربع",
        quantity: "10.000000",
        minimumQuantity: "2.000000",
        sellPriceIqd: "10000",
        purchasePriceUsd: "3.5000",
        createdAt: "2026-07-31T10:00:00Z",
        updatedAt: "2026-07-31T10:00:00Z",
    };
}

function clientWithPages(pages: ProductListDto[]): { client: ApiClient; calls: number[] } {
    const calls: number[] = [];
    const client: ApiClient = {
        async get<T>(_path, options) {
            const page = Number(options?.query?.page ?? 1);
            calls.push(page);
            return pages[Math.min(page - 1, pages.length - 1)] as T;
        },
        async post<T>() { return dto(1) as T; },
        async patch<T>() { return dto(1) as T; },
        async delete() {},
    };
    return { client, calls };
}

test("API repository combines pages in predictable order and stops", async () => {
    const first = { items: [dto(1), dto(2)], total: 3, page: 1, pageSize: 100, totalPages: 2 };
    const second = { items: [dto(3)], total: 3, page: 2, pageSize: 100, totalPages: 2 };
    const mock = clientWithPages([first, second]);
    const products = await new ApiProductRepository(mock.client).listAll();
    assert.deepEqual(products.map((product) => product.id), [1, 2, 3]);
    assert.deepEqual(mock.calls, [1, 2]);
});

test("API repository rejects repeated or malformed pagination", async () => {
    const malformed = { items: [dto(1)], total: 2, page: 1, pageSize: 100, totalPages: 2 };
    const repository = new ApiProductRepository(clientWithPages([malformed]).client);
    await assert.rejects(
        repository.listAll(),
        (error: unknown) => error instanceof ApiError && error.code === "invalid_pagination_response",
    );
});

test("local repository preserves the existing key and factory selects implementations", async () => {
    const values = new Map<string, string>();
    const storage = {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => { values.set(key, value); },
    };
    values.set(PRODUCTS_STORAGE_KEY, "[]");
    const local = createProductRepository(
        { apiBaseUrl: "https://example.test/api", dataSource: "localStorage" },
        storage,
    );
    assert.ok(local instanceof LocalStorageProductRepository);
    await local.create({
        code: "LOCAL-1", name: "Local", size: "1x1", company: "Company",
        unit: "قطعة", quantity: 1, minimumQuantity: 0, sellPriceIqd: 1, purchasePriceUsd: 1,
    });
    assert.ok(values.get(PRODUCTS_STORAGE_KEY)?.includes("LOCAL-1"));
    assert.ok(
        createProductRepository({ apiBaseUrl: "https://example.test/api", dataSource: "api" })
            instanceof ApiProductRepository,
    );
});

test("future UI error mapping provides readable Arabic messages", () => {
    assert.equal(
        apiErrorToArabic(new ApiError({ code: "network_error", message: "x", kind: "network" })),
        "تعذر الاتصال بالخادم.",
    );
    assert.equal(
        apiErrorToArabic(new ApiError({ status: 409, code: "duplicate_product_code", message: "x", kind: "conflict" })),
        "يوجد منتج آخر يحمل هذا الكود.",
    );
    assert.equal(
        apiErrorToArabic(new ProductMappingError("Product quantity must be changed through the inventory movement API")),
        "يجب تعديل كمية المنتج من خلال حركة مخزون.",
    );
});
