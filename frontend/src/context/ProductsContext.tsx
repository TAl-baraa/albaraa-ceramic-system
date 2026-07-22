import {
    createContext,
    useContext,
    useEffect,
    useState,
} from "react";
import type { ReactNode } from "react";

import { initialProducts } from "../data/initialProducts";
import type { Product, ProductUnit } from "../types/product";

type ProductsContextValue = {
    products: Product[];
    addProduct: (product: Product) => void;
    updateProduct: (product: Product) => void;
    deleteProduct: (productId: number) => void;
};

type ProductsProviderProps = {
    children: ReactNode;
};

type StoredProduct = Partial<Product> & {
    initialQuantity?: unknown;
};

const STORAGE_KEY = "albaraa-ceramic-products";
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

export function ProductsProvider({
    children,
}: ProductsProviderProps) {
    const [products, setProducts] =
        useState<Product[]>(getStoredProducts);

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

    return (
        <ProductsContext.Provider
            value={{
                products,
                addProduct,
                updateProduct,
                deleteProduct,
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
