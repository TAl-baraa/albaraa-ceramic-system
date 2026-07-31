import type { ProductUnit } from "./product";

export type StockMovementType = "in" | "out" | "adjustment";
export type StockMovementSourceType =
    | "manual"
    | "sale_invoice"
    | "sale_invoice_cancellation"
    | "migration"
    | (string & {});

export type StockMovement = {
    id: number;
    productId: number;
    type: StockMovementType;
    quantity: number;
    previousQuantity: number;
    newQuantity: number;
    note: string;
    createdAt: string;
    sourceType: StockMovementSourceType;
    sourceId: number | null;
    sourceReference: string;
};

export type StockMovementInput = Pick<
    StockMovement,
    "productId" | "type" | "quantity" | "note"
>;

export type AddStockMovementResult =
    | { success: true }
    | { success: false; error: string };

export type StockMovementRecord = StockMovement & {
    productCode: string;
    productName: string;
    productUnit: ProductUnit | null;
};

export type InventorySummary = {
    totalProducts: number;
    totalSquareMeters: number;
    totalPieces: number;
    lowStockCount: number;
    outOfStockCount: number;
    totalSaleValueIqd: number;
    totalPurchaseValueUsd: number;
};

export type LowStockProduct = {
    productId: number;
    code: string;
    name: string;
    quantity: number;
    minimumQuantity: number;
    unit: ProductUnit;
    status: "out_of_stock" | "low_stock";
};

export type InventoryQuantityInput = {
    productId: number;
    quantity: number;
    note: string;
    unit?: ProductUnit;
};

export type InventoryAdjustmentInput = {
    productId: number;
    finalQuantity: number;
    note: string;
    unit?: ProductUnit;
};
