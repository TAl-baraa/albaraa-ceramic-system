import assert from "node:assert/strict";
import test from "node:test";

import {
    ProductMappingError,
    productCreateToDto,
    productDtoToDomain,
    productUpdateToDto,
} from "../src/api/products/productMappers.ts";
import type { ProductDto } from "../src/api/products/productApiTypes.ts";

const dto: ProductDto = {
    id: 7,
    code: " CER-7 ",
    name: " Ceramic ",
    size: " 60x60 ",
    company: " Company ",
    unit: "متر مربع",
    quantity: "12.500000",
    minimumQuantity: "2.000000",
    sellPriceIqd: "25000",
    purchasePriceUsd: "8.7500",
    createdAt: "2026-07-31T10:00:00Z",
    updatedAt: "2026-07-31T11:00:00Z",
};

test("maps camelCase decimal-string DTOs and keeps API timestamps separately", () => {
    const product = productDtoToDomain(dto);
    assert.equal(product.quantity, 12.5);
    assert.equal(product.minimumQuantity, 2);
    assert.equal(product.sellPriceIqd, 25000);
    assert.equal(product.purchasePriceUsd, 8.75);
    assert.equal(product.unit, "متر مربع");
    assert.deepEqual(product.apiMetadata, {
        createdAt: dto.createdAt,
        updatedAt: dto.updatedAt,
    });
});

test("rejects malformed, non-Western, and unsafe IQD numeric strings", () => {
    for (const sellPriceIqd of ["1,000", "١٠٠٠", "9007199254740992"]) {
        assert.throws(
            () => productDtoToDomain({ ...dto, sellPriceIqd }),
            ProductMappingError,
        );
    }
    assert.throws(() => productDtoToDomain({ ...dto, quantity: "not-a-number" }), ProductMappingError);
});

test("create mapping trims text, keeps Arabic units, and emits Western numeric strings", () => {
    const result = productCreateToDto({
        code: " A1 ",
        name: " Tile ",
        size: " 30x30 ",
        company: " Maker ",
        unit: "قطعة",
        quantity: 12,
        minimumQuantity: 2,
        sellPriceIqd: 1500,
        purchasePriceUsd: 1.25,
    });
    assert.equal(result.code, "A1");
    assert.equal(result.unit, "قطعة");
    assert.equal(result.quantity, "12");
    assert.equal(/[٠-٩۰-۹]/.test(JSON.stringify(result)), false);
});

test("update mapping blocks quantity while allowing inventory metadata", () => {
    assert.throws(() => productUpdateToDto({ quantity: 4 }), /inventory movement API/);
    assert.deepEqual(productUpdateToDto({ name: " New name ", minimumQuantity: 3 }), {
        name: "New name",
        minimumQuantity: "3",
    });
});
