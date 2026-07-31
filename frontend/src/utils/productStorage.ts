import { initialProducts } from "../data/initialProducts.ts";
import type { Product, ProductUnit } from "../types/product";

export const PRODUCTS_STORAGE_KEY = "albaraa-ceramic-products";

type StoredProduct = Partial<Product> & {
    initialQuantity?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function isFiniteNonNegativeNumber(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isProductUnit(value: unknown): value is ProductUnit {
    return value === "متر مربع" || value === "قطعة";
}

export function migrateStoredProduct(value: unknown): Product | null {
    if (!isRecord(value)) return null;
    const storedProduct: StoredProduct = value;
    const quantity = storedProduct.quantity ?? storedProduct.initialQuantity;
    if (
        !isFiniteNonNegativeNumber(storedProduct.id) ||
        typeof storedProduct.code !== "string" ||
        typeof storedProduct.name !== "string" ||
        typeof storedProduct.size !== "string" ||
        typeof storedProduct.company !== "string" ||
        !isProductUnit(storedProduct.unit) ||
        !isFiniteNonNegativeNumber(quantity) ||
        !isFiniteNonNegativeNumber(storedProduct.minimumQuantity) ||
        !isFiniteNonNegativeNumber(storedProduct.sellPriceIqd) ||
        !isFiniteNonNegativeNumber(storedProduct.purchasePriceUsd)
    ) {
        return null;
    }
    return {
        id: storedProduct.id,
        code: storedProduct.code,
        name: storedProduct.name,
        size: storedProduct.size,
        company: storedProduct.company,
        unit: storedProduct.unit,
        quantity,
        minimumQuantity: storedProduct.minimumQuantity,
        sellPriceIqd: storedProduct.sellPriceIqd,
        purchasePriceUsd: storedProduct.purchasePriceUsd,
    };
}

export function readStoredProducts(storage: Pick<Storage, "getItem"> = localStorage): Product[] {
    try {
        const storedValue = storage.getItem(PRODUCTS_STORAGE_KEY);
        if (!storedValue) return initialProducts;
        const parsedValue: unknown = JSON.parse(storedValue);
        if (!Array.isArray(parsedValue)) return initialProducts;
        const products = parsedValue
            .map(migrateStoredProduct)
            .filter((product): product is Product => product !== null);
        return products.length > 0 || parsedValue.length === 0 ? products : initialProducts;
    } catch {
        return initialProducts;
    }
}

export function writeStoredProducts(
    products: readonly Product[],
    storage: Pick<Storage, "setItem"> = localStorage,
): void {
    storage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(products));
}
