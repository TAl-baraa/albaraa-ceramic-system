import type {
    InventoryAdjustmentInput,
    InventoryQuantityInput,
    InventorySummary,
    LowStockProduct,
    StockMovementRecord,
    StockMovementType,
} from "../types/stockMovement";

export type InventoryRequestOptions = { signal?: AbortSignal };

export type MovementListOptions = InventoryRequestOptions & {
    productId?: number;
    movementType?: StockMovementType;
    sourceType?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    pageSize?: number;
};

export type MovementPage = {
    items: StockMovementRecord[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
};

export type LowStockOptions = InventoryRequestOptions & {
    includeOutOfStock?: boolean;
    limit?: number;
};

export interface InventoryRepository {
    getSummary(options?: InventoryRequestOptions): Promise<InventorySummary>;
    listLowStock(options?: LowStockOptions): Promise<LowStockProduct[]>;
    listMovements(options?: MovementListOptions): Promise<MovementPage>;
    listAllMovements(options?: Omit<MovementListOptions, "page" | "pageSize">): Promise<StockMovementRecord[]>;
    getMovementById(id: number, options?: InventoryRequestOptions): Promise<StockMovementRecord>;
    createStockIn(input: InventoryQuantityInput, options?: InventoryRequestOptions): Promise<StockMovementRecord>;
    createStockOut(input: InventoryQuantityInput, options?: InventoryRequestOptions): Promise<StockMovementRecord>;
    createAdjustment(input: InventoryAdjustmentInput, options?: InventoryRequestOptions): Promise<StockMovementRecord>;
}
