import type { ProductUnit } from "../../types/product";
import type {
    InventoryAdjustmentInput,
    InventoryQuantityInput,
    InventorySummary,
    LowStockProduct,
    StockMovementRecord,
    StockMovementType,
} from "../../types/stockMovement";
import type {
    InventorySummaryDto,
    LowStockProductDto,
    StockAdjustmentRequestDto,
    StockInRequestDto,
    StockMovementDto,
    StockOutRequestDto,
} from "./inventoryApiTypes";

const DECIMAL_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;

export class InventoryMappingError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "InventoryMappingError";
    }
}

function decimal(value: string, field: string): number {
    if (!DECIMAL_PATTERN.test(value)) {
        throw new InventoryMappingError(`${field} is not a valid decimal string`);
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed > Number.MAX_SAFE_INTEGER) {
        throw new InventoryMappingError(`${field} is outside the supported numeric range`);
    }
    return parsed;
}

function id(value: number, field: string): number {
    if (!Number.isSafeInteger(value) || value <= 0) {
        throw new InventoryMappingError(`${field} is invalid`);
    }
    return value;
}

function nonnegativeInteger(value: number, field: string): number {
    if (!Number.isSafeInteger(value) || value < 0) {
        throw new InventoryMappingError(`${field} is invalid`);
    }
    return value;
}

function unit(value: ProductUnit): ProductUnit {
    if (value !== "متر مربع" && value !== "قطعة") {
        throw new InventoryMappingError("Product unit is invalid");
    }
    return value;
}

function movementType(value: StockMovementType): StockMovementType {
    if (value !== "in" && value !== "out" && value !== "adjustment") {
        throw new InventoryMappingError("Movement type is invalid");
    }
    return value;
}

function timestamp(value: string): string {
    if (!Number.isFinite(Date.parse(value))) {
        throw new InventoryMappingError("Movement timestamp is invalid");
    }
    return value;
}

function validatePieceQuantity(value: number, productUnit: ProductUnit): void {
    if (productUnit === "قطعة" && !Number.isInteger(value)) {
        throw new InventoryMappingError("Piece quantities must be whole numbers");
    }
}

function requestQuantity(value: number, productUnit?: ProductUnit): string {
    if (!Number.isFinite(value) || value <= 0 || value > Number.MAX_SAFE_INTEGER) {
        throw new InventoryMappingError("Movement quantity must be greater than zero");
    }
    if (productUnit) validatePieceQuantity(value, productUnit);
    return String(value);
}

function requestFinalQuantity(value: number, productUnit?: ProductUnit): string {
    if (!Number.isFinite(value) || value < 0 || value > Number.MAX_SAFE_INTEGER) {
        throw new InventoryMappingError("Adjustment final quantity must be nonnegative");
    }
    if (productUnit) validatePieceQuantity(value, productUnit);
    return String(value);
}

export function stockMovementDtoToDomain(dto: StockMovementDto): StockMovementRecord {
    const productUnit = unit(dto.productUnit);
    const quantity = decimal(dto.quantity, "quantity");
    const previousQuantity = decimal(dto.previousQuantity, "previousQuantity");
    const newQuantity = decimal(dto.newQuantity, "newQuantity");
    validatePieceQuantity(quantity, productUnit);
    validatePieceQuantity(previousQuantity, productUnit);
    validatePieceQuantity(newQuantity, productUnit);
    if (!dto.sourceType.trim()) throw new InventoryMappingError("Movement source is required");
    if (dto.sourceId !== null) id(dto.sourceId, "Source id");
    return {
        id: id(dto.id, "Movement id"),
        productId: id(dto.productId, "Product id"),
        type: movementType(dto.movementType),
        quantity,
        previousQuantity,
        newQuantity,
        note: dto.note.trim(),
        sourceType: dto.sourceType.trim(),
        sourceId: dto.sourceId,
        sourceReference: dto.sourceReference.trim(),
        createdAt: timestamp(dto.createdAt),
        productCode: dto.productCode.trim(),
        productName: dto.productName.trim(),
        productUnit,
    };
}

export function inventorySummaryDtoToDomain(dto: InventorySummaryDto): InventorySummary {
    return {
        totalProducts: nonnegativeInteger(dto.totalProducts, "totalProducts"),
        totalSquareMeters: decimal(dto.totalSquareMeters, "totalSquareMeters"),
        totalPieces: decimal(dto.totalPieces, "totalPieces"),
        lowStockCount: nonnegativeInteger(dto.lowStockCount, "lowStockCount"),
        outOfStockCount: nonnegativeInteger(dto.outOfStockCount, "outOfStockCount"),
        totalSaleValueIqd: decimal(dto.totalSaleValueIqd, "totalSaleValueIqd"),
        totalPurchaseValueUsd: decimal(dto.totalPurchaseValueUsd, "totalPurchaseValueUsd"),
    };
}

export function lowStockProductDtoToDomain(dto: LowStockProductDto): LowStockProduct {
    const productUnit = unit(dto.unit);
    const quantity = decimal(dto.quantity, "quantity");
    const minimumQuantity = decimal(dto.minimumQuantity, "minimumQuantity");
    validatePieceQuantity(quantity, productUnit);
    validatePieceQuantity(minimumQuantity, productUnit);
    if (dto.status !== "out_of_stock" && dto.status !== "low_stock") {
        throw new InventoryMappingError("Low-stock status is invalid");
    }
    return {
        productId: id(dto.productId, "Product id"),
        code: dto.code.trim(),
        name: dto.name.trim(),
        quantity,
        minimumQuantity,
        unit: productUnit,
        status: dto.status,
    };
}

export function stockInInputToDto(input: InventoryQuantityInput): StockInRequestDto {
    return {
        productId: id(input.productId, "Product id"),
        quantity: requestQuantity(input.quantity, input.unit),
        note: input.note.trim(),
    };
}

export function stockOutInputToDto(input: InventoryQuantityInput): StockOutRequestDto {
    return stockInInputToDto(input);
}

export function stockAdjustmentInputToDto(
    input: InventoryAdjustmentInput,
): StockAdjustmentRequestDto {
    const note = input.note.trim();
    if (!note) throw new InventoryMappingError("Adjustment note is required");
    return {
        productId: id(input.productId, "Product id"),
        finalQuantity: requestFinalQuantity(input.finalQuantity, input.unit),
        note,
    };
}
