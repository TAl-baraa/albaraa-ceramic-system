import type { ProductUnit } from "../../types/product";

export type StockMovementTypeDto = "in" | "out" | "adjustment";

export type StockMovementDto = {
    id: number;
    productId: number;
    movementType: StockMovementTypeDto;
    quantity: string;
    previousQuantity: string;
    newQuantity: string;
    note: string;
    sourceType: string;
    sourceId: number | null;
    sourceReference: string;
    createdAt: string;
    productCode: string;
    productName: string;
    productUnit: ProductUnit;
};

export type StockMovementListDto = {
    items: StockMovementDto[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
};

export type InventorySummaryDto = {
    totalProducts: number;
    totalSquareMeters: string;
    totalPieces: string;
    lowStockCount: number;
    outOfStockCount: number;
    totalSaleValueIqd: string;
    totalPurchaseValueUsd: string;
};

export type LowStockProductDto = {
    productId: number;
    code: string;
    name: string;
    quantity: string;
    minimumQuantity: string;
    unit: ProductUnit;
    status: "out_of_stock" | "low_stock";
};

export type StockInRequestDto = {
    productId: number;
    quantity: string;
    note: string;
};

export type StockOutRequestDto = StockInRequestDto;

export type StockAdjustmentRequestDto = {
    productId: number;
    finalQuantity: string;
    note: string;
};
