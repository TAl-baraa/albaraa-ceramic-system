import { ApiError } from "../api/apiClient.ts";
import type { Product } from "../types/product";
import type {
    InventoryAdjustmentInput,
    InventoryQuantityInput,
    InventorySummary,
    LowStockProduct,
    StockMovement,
    StockMovementRecord,
} from "../types/stockMovement";
import { readStoredProducts, writeStoredProducts } from "../utils/productStorage.ts";
import {
    readStoredStockMovements,
    writeStoredStockMovements,
} from "../utils/stockMovementStorage.ts";
import type {
    InventoryRepository,
    InventoryRequestOptions,
    LowStockOptions,
    MovementListOptions,
    MovementPage,
} from "./InventoryRepository";

type InventoryStorage = Pick<Storage, "getItem" | "setItem">;

function normalizeQuantity(quantity: number): number {
    return Number(quantity.toFixed(6));
}

export class LocalStorageInventoryRepository implements InventoryRepository {
    private readonly storage: InventoryStorage;

    constructor(storage: InventoryStorage = localStorage) {
        this.storage = storage;
    }

    private products(): Product[] {
        return readStoredProducts(this.storage);
    }

    private enrich(movement: StockMovement, products = this.products()): StockMovementRecord {
        const product = products.find((item) => item.id === movement.productId);
        return {
            ...movement,
            productCode: product?.code || movement.sourceReference || "منتج محذوف",
            productName: product?.name || "منتج محذوف",
            productUnit: product?.unit ?? null,
        };
    }

    async getSummary(_options: InventoryRequestOptions = {}): Promise<InventorySummary> {
        const products = this.products();
        return {
            totalProducts: products.length,
            totalSquareMeters: products
                .filter((product) => product.unit === "متر مربع")
                .reduce((total, product) => total + product.quantity, 0),
            totalPieces: products
                .filter((product) => product.unit === "قطعة")
                .reduce((total, product) => total + product.quantity, 0),
            lowStockCount: products.filter(
                (product) => product.quantity <= product.minimumQuantity,
            ).length,
            outOfStockCount: products.filter((product) => product.quantity <= 0).length,
            totalSaleValueIqd: products.reduce(
                (total, product) => total + product.quantity * product.sellPriceIqd,
                0,
            ),
            totalPurchaseValueUsd: products.reduce(
                (total, product) => total + product.quantity * product.purchasePriceUsd,
                0,
            ),
        };
    }

    async listLowStock(options: LowStockOptions = {}): Promise<LowStockProduct[]> {
        return this.products()
            .filter(
                (product) =>
                    product.quantity <= product.minimumQuantity &&
                    (options.includeOutOfStock !== false || product.quantity > 0),
            )
            .map((product) => ({
                productId: product.id,
                code: product.code,
                name: product.name,
                quantity: product.quantity,
                minimumQuantity: product.minimumQuantity,
                unit: product.unit,
                status: product.quantity <= 0 ? "out_of_stock" as const : "low_stock" as const,
            }))
            .toSorted(
                (first, second) =>
                    Number(first.status !== "out_of_stock") -
                        Number(second.status !== "out_of_stock") ||
                    first.quantity - second.quantity || first.code.localeCompare(second.code),
            )
            .slice(0, options.limit ?? 50);
    }

    async listMovements(options: MovementListOptions = {}): Promise<MovementPage> {
        const products = this.products();
        const normalizedSearch = options.search?.trim().toLocaleLowerCase("ar") ?? "";
        const movements = readStoredStockMovements(this.storage)
            .map((movement) => this.enrich(movement, products))
            .filter(
                (movement) =>
                    (!options.productId || movement.productId === options.productId) &&
                    (!options.movementType || movement.type === options.movementType) &&
                    (!options.sourceType || movement.sourceType === options.sourceType) &&
                    (!options.dateFrom || movement.createdAt >= options.dateFrom) &&
                    (!options.dateTo || movement.createdAt <= options.dateTo) &&
                    (!normalizedSearch ||
                        movement.productCode.toLocaleLowerCase("ar").includes(normalizedSearch) ||
                        movement.productName.toLocaleLowerCase("ar").includes(normalizedSearch) ||
                        movement.sourceReference.toLocaleLowerCase("ar").includes(normalizedSearch) ||
                        movement.note.toLocaleLowerCase("ar").includes(normalizedSearch)),
            );
        const page = options.page ?? 1;
        const pageSize = options.pageSize ?? 20;
        return {
            items: movements.slice((page - 1) * pageSize, page * pageSize),
            total: movements.length,
            page,
            pageSize,
            totalPages: movements.length ? Math.ceil(movements.length / pageSize) : 0,
        };
    }

    async listAllMovements(
        options: Omit<MovementListOptions, "page" | "pageSize"> = {},
    ): Promise<StockMovementRecord[]> {
        return (await this.listMovements({
            ...options,
            page: 1,
            pageSize: Number.MAX_SAFE_INTEGER,
        })).items;
    }

    async getMovementById(id: number): Promise<StockMovementRecord> {
        const movement = readStoredStockMovements(this.storage).find((item) => item.id === id);
        if (!movement) {
            throw new ApiError({ status: 404, code: "stock_movement_not_found", message: "Movement not found", kind: "not_found" });
        }
        return this.enrich(movement);
    }

    createStockIn(input: InventoryQuantityInput): Promise<StockMovementRecord> {
        return this.createMovement("in", input);
    }

    createStockOut(input: InventoryQuantityInput): Promise<StockMovementRecord> {
        return this.createMovement("out", input);
    }

    createAdjustment(input: InventoryAdjustmentInput): Promise<StockMovementRecord> {
        return this.createMovement("adjustment", {
            productId: input.productId,
            quantity: input.finalQuantity,
            note: input.note,
            unit: input.unit,
        });
    }

    private async createMovement(
        type: "in" | "out" | "adjustment",
        input: InventoryQuantityInput,
    ): Promise<StockMovementRecord> {
        const products = this.products();
        const product = products.find((item) => item.id === input.productId);
        if (!product) throw new ApiError({ status: 404, code: "product_not_found", message: "Product not found", kind: "not_found" });
        if (!Number.isFinite(input.quantity) || input.quantity < 0 || (type !== "adjustment" && input.quantity === 0)) {
            throw new ApiError({ status: 422, code: "invalid_movement_quantity", message: "Invalid quantity", kind: "validation" });
        }
        if (product.unit === "قطعة" && !Number.isInteger(input.quantity)) {
            throw new ApiError({ status: 422, code: "invalid_piece_quantity", message: "Invalid piece quantity", kind: "validation" });
        }
        if (type === "out" && input.quantity > product.quantity) {
            throw new ApiError({
                status: 409,
                code: "insufficient_stock",
                message: "Insufficient stock",
                details: {
                    productId: product.id,
                    productCode: product.code,
                    requestedQuantity: String(input.quantity),
                    availableQuantity: String(product.quantity),
                    unit: product.unit,
                },
                kind: "conflict",
            });
        }
        const previousQuantity = product.quantity;
        const newQuantity = normalizeQuantity(
            type === "in"
                ? previousQuantity + input.quantity
                : type === "out"
                  ? previousQuantity - input.quantity
                  : input.quantity,
        );
        const existingMovements = readStoredStockMovements(this.storage);
        const movement: StockMovement = {
            id: Math.max(Date.now(), (existingMovements[0]?.id ?? 0) + 1),
            productId: product.id,
            type,
            quantity: input.quantity,
            previousQuantity,
            newQuantity,
            note: input.note.trim(),
            createdAt: new Date().toISOString(),
            sourceType: "manual",
            sourceId: null,
            sourceReference: "",
        };
        writeStoredProducts(
            products.map((item) => item.id === product.id ? { ...item, quantity: newQuantity } : item),
            this.storage,
        );
        writeStoredStockMovements([movement, ...existingMovements], this.storage);
        return this.enrich(movement, products);
    }
}
