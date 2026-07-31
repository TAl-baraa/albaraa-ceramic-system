import {
    createContext,
    useContext,
    useEffect,
    useState,
} from "react";
import type { ReactNode } from "react";

import type { Product } from "../types/product";
import type {
    AddStockMovementResult,
    StockMovement,
    StockMovementInput,
} from "../types/stockMovement";
import {
    readStoredProducts,
    writeStoredProducts,
} from "../utils/productStorage";
import {
    readStoredStockMovements,
    writeStoredStockMovements,
} from "../utils/stockMovementStorage";

type ProductsContextValue = {
    products: Product[];
    addProduct: (product: Product) => void;
    updateProduct: (product: Product) => void;
    deleteProduct: (productId: number) => void;
    stockMovements: StockMovement[];
    addStockMovement: (
        movement: StockMovementInput,
    ) => AddStockMovementResult;
    applySaleStockPlan: (
        updatedProducts: Product[],
        movements: StockMovement[],
    ) => void;
};

type ProductsProviderProps = {
    children: ReactNode;
};

const ProductsContext =
    createContext<ProductsContextValue | null>(null);

function normalizeQuantity(quantity: number) {
    return Number(quantity.toFixed(6));
}

export function ProductsProvider({
    children,
}: ProductsProviderProps) {
    const [products, setProducts] =
        useState<Product[]>(readStoredProducts);
    const [stockMovements, setStockMovements] =
        useState<StockMovement[]>(readStoredStockMovements);

    useEffect(() => {
        try {
            writeStoredProducts(products);
        } catch {
            // Keep in-memory state usable if storage is unavailable or full.
        }
    }, [products]);

    useEffect(() => {
        try {
            writeStoredStockMovements(stockMovements);
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
            sourceType: "manual",
            sourceId: null,
            sourceReference: "",
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

    function applySaleStockPlan(
        updatedProducts: Product[],
        movements: StockMovement[],
    ) {
        const updatesById = new Map(
            updatedProducts.map((product) => [product.id, product]),
        );

        setProducts((currentProducts) =>
            currentProducts.map(
                (product) => updatesById.get(product.id) ?? product,
            ),
        );
        setStockMovements((currentMovements) =>
            [...movements, ...currentMovements].toSorted(
                (first, second) =>
                    Date.parse(second.createdAt) -
                        Date.parse(first.createdAt) ||
                    second.id - first.id,
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
                stockMovements,
                addStockMovement,
                applySaleStockPlan,
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
