import type {
    StockMovement,
    StockMovementType,
} from "../types/stockMovement";

export const STOCK_MOVEMENTS_STORAGE_KEY =
    "albaraa-ceramic-stock-movements";

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function isFiniteNonNegativeNumber(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isStockMovementType(value: unknown): value is StockMovementType {
    return value === "in" || value === "out" || value === "adjustment";
}

export function parseStoredStockMovement(value: unknown): StockMovement | null {
    if (!isRecord(value)) return null;
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
    ) return null;

    return {
        id: value.id,
        productId: value.productId,
        type: value.type,
        quantity: value.quantity,
        previousQuantity: value.previousQuantity,
        newQuantity: value.newQuantity,
        note: value.note,
        createdAt: value.createdAt,
        sourceType:
            value.sourceType === "sale_invoice" ||
            value.sourceType === "sale_invoice_cancellation"
                ? value.sourceType
                : "manual",
        sourceId: isFiniteNonNegativeNumber(value.sourceId) ? value.sourceId : null,
        sourceReference:
            typeof value.sourceReference === "string" ? value.sourceReference : "",
    };
}

export function readStoredStockMovements(
    storage: Pick<Storage, "getItem"> = localStorage,
): StockMovement[] {
    try {
        const raw = storage.getItem(STOCK_MOVEMENTS_STORAGE_KEY);
        if (!raw) return [];
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed
            .map(parseStoredStockMovement)
            .filter((movement): movement is StockMovement => movement !== null)
            .toSorted(
                (first, second) =>
                    Date.parse(second.createdAt) - Date.parse(first.createdAt) ||
                    second.id - first.id,
            );
    } catch {
        return [];
    }
}

export function writeStoredStockMovements(
    movements: readonly StockMovement[],
    storage: Pick<Storage, "setItem"> = localStorage,
): void {
    storage.setItem(STOCK_MOVEMENTS_STORAGE_KEY, JSON.stringify(movements));
}
