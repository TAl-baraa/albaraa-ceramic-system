import {
    createContext,
    useContext,
    useEffect,
    useState,
} from "react";
import type { ReactNode } from "react";

import { initialProducts } from "../data/initialProducts";
import type { Product, ProductUnit } from "../types/product";
import type {
    AddStockMovementResult,
    StockMovement,
    StockMovementInput,
    StockMovementType,
} from "../types/stockMovement";

type ProductsContextValue = {
    products: Product[];
    addProduct: (product: Product) => void;
    updateProduct: (product: Product) => void;
    deleteProduct: (productId: number) => void;
    stockMovements: StockMovement[];
    addStockMovement: (
        movement: StockMovementInput,
    ) => AddStockMovementResult;
};

type ProductsProviderProps = {
    children: ReactNode;
};

type StoredProduct = Partial<Product> & {
    initialQuantity?: unknown;
};

const STORAGE_KEY = "albaraa-ceramic-products";
const MOVEMENTS_STORAGE_KEY = "albaraa-ceramic-stock-movements";
const ProductsContext =
    createContext<ProductsContextValue | null>(null);

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function isFiniteNonNegativeNumber(value: unknown): value is number {
    return (
        typeof value === "number" &&
        Number.isFinite(value) &&
        value >= 0
    );
}

function isProductUnit(value: unknown): value is ProductUnit {
    return value === "متر مربع" || value === "قطعة";
}

function isStockMovementType(
    value: unknown,
): value is StockMovementType {
    return (
        value === "in" ||
        value === "out" ||
        value === "adjustment"
    );
}

function parseStoredMovement(value: unknown): StockMovement | null {
    if (!isRecord(value)) {
        return null;
    }

    if (
        !isFiniteNonNegativeNumber(value.id) ||
        !isFiniteNonNegativeNumber(value.productId) ||
        !isStockMovementType(value.type) ||
        !isFiniteNonNegativeNumber(value.quantity) ||
        !isFiniteNonNegativeNumber(value.previousQuantity) ||
        !isFiniteNonNegativeNumber(value.newQuantity) ||
        typeof value.note !== "string" ||
        typeof value.createdAt !== "string" ||
        !Number.isFinite(Date.parse(value.createdAt))
    ) {
        return null;
    }

    return {
        id: value.id,
        productId: value.productId,
        type: value.type,
        quantity: value.quantity,
        previousQuantity: value.previousQuantity,
        newQuantity: value.newQuantity,
        note: value.note,
        createdAt: value.createdAt,
    };
}

function migrateStoredProduct(value: unknown): Product | null {
    if (!isRecord(value)) {
        return null;
    }

    const storedProduct: StoredProduct = value;
    const quantity =
        storedProduct.quantity ?? storedProduct.initialQuantity;

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

function getStoredProducts(): Product[] {
    try {
        const storedValue = localStorage.getItem(STORAGE_KEY);

        if (!storedValue) {
            return initialProducts;
        }

        const parsedValue: unknown = JSON.parse(storedValue);

        if (!Array.isArray(parsedValue)) {
            return initialProducts;
        }

        const products = parsedValue
            .map(migrateStoredProduct)
            .filter((product): product is Product => product !== null);

        return products.length > 0 || parsedValue.length === 0
            ? products
            : initialProducts;
    } catch {
        return initialProducts;
    }
}

function getStoredMovements(): StockMovement[] {
    try {
        const storedValue = localStorage.getItem(
            MOVEMENTS_STORAGE_KEY,
        );

        if (!storedValue) {
            return [];
        }

        const parsedValue: unknown = JSON.parse(storedValue);

        if (!Array.isArray(parsedValue)) {
            return [];
        }

        return parsedValue
            .map(parseStoredMovement)
            .filter(
                (movement): movement is StockMovement =>
                    movement !== null,
            )
            .sort(
                (first, second) =>
                    Date.parse(second.createdAt) -
                    Date.parse(first.createdAt),
            );
    } catch {
        return [];
    }
}

function normalizeQuantity(quantity: number) {
    return Number(quantity.toFixed(6));
}

export function ProductsProvider({
    children,
}: ProductsProviderProps) {
    const [products, setProducts] =
        useState<Product[]>(getStoredProducts);
    const [stockMovements, setStockMovements] =
        useState<StockMovement[]>(getStoredMovements);

    useEffect(() => {
        try {
            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(products),
            );
        } catch {
            // Keep in-memory state usable if storage is unavailable or full.
        }
    }, [products]);

    useEffect(() => {
        try {
            localStorage.setItem(
                MOVEMENTS_STORAGE_KEY,
                JSON.stringify(stockMovements),
            );
        } catch {
            // Keep in-memory history usable if storage is unavailable or full.
        }
    }, [stockMovements]);

    function addProduct(product: Product) {
        setProducts((currentProducts) => [
            product,
            ...currentProducts,
        ]);
    }

    function updateProduct(updatedProduct: Product) {
        setProducts((currentProducts) =>
            currentProducts.map((product) =>
                product.id === updatedProduct.id
                    ? updatedProduct
                    : product,
            ),
        );
    }

    function deleteProduct(productId: number) {
        setProducts((currentProducts) =>
            currentProducts.filter(
                (product) => product.id !== productId,
            ),
        );
    }

    function addStockMovement(
        input: StockMovementInput,
    ): AddStockMovementResult {
        const product = products.find(
            (currentProduct) => currentProduct.id === input.productId,
        );

        if (!product) {
            return {
                success: false,
                error: "يرجى اختيار منتج صالح.",
            };
        }

        if (
            !Number.isFinite(input.quantity) ||
            input.quantity < 0 ||
            (input.type !== "adjustment" && input.quantity === 0)
        ) {
            return {
                success: false,
                error:
                    input.type === "adjustment"
                        ? "يجب أن تكون الكمية الجديدة صفرًا أو رقمًا موجبًا."
                        : "يجب أن تكون الكمية رقمًا موجبًا.",
            };
        }

        if (
            product.unit === "قطعة" &&
            !Number.isInteger(input.quantity)
        ) {
            return {
                success: false,
                error: "كميات المنتجات المقاسة بالقطعة يجب أن تكون أعدادًا صحيحة.",
            };
        }

        if (
            input.type === "out" &&
            input.quantity > product.quantity
        ) {
            return {
                success: false,
                error: "كمية الإخراج أكبر من الكمية المتوفرة.",
            };
        }

        const previousQuantity = product.quantity;
        const newQuantity = normalizeQuantity(
            input.type === "in"
                ? previousQuantity + input.quantity
                : input.type === "out"
                  ? previousQuantity - input.quantity
                  : input.quantity,
        );
        const createdAt = new Date().toISOString();
        const newestMovementId = stockMovements[0]?.id ?? 0;
        const movement: StockMovement = {
            id: Math.max(Date.now(), newestMovementId + 1),
            productId: product.id,
            type: input.type,
            quantity: input.quantity,
            previousQuantity,
            newQuantity,
            note: input.note.trim(),
            createdAt,
        };

        setProducts((currentProducts) =>
            currentProducts.map((currentProduct) =>
                currentProduct.id === product.id
                    ? { ...currentProduct, quantity: newQuantity }
                    : currentProduct,
            ),
        );
        setStockMovements((currentMovements) => [
            movement,
            ...currentMovements,
        ]);

        return { success: true };
    }

    return (
        <ProductsContext.Provider
            value={{
                products,
                addProduct,
                updateProduct,
                deleteProduct,
                stockMovements,
                addStockMovement,
            }}
        >
            {children}
        </ProductsContext.Provider>
    );
}

// The hook intentionally lives beside its provider as their single public API.
// oxlint-disable-next-line react/only-export-components
export function useProducts() {
    const context = useContext(ProductsContext);

    if (!context) {
        throw new Error(
            "useProducts must be used inside ProductsProvider",
        );
    }

    return context;
}
