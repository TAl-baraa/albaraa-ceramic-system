import {
    initialSaleInvoiceItems,
    initialSaleInvoices,
} from "../data/initialSales.ts";
import type {
    SaleInvoice,
    SaleInvoiceItem,
    SaleInvoiceStatus,
} from "../types/sale";

export const SALES_INVOICES_STORAGE_KEY =
    "albaraa-ceramic-sale-invoices";
export const SALES_ITEMS_STORAGE_KEY =
    "albaraa-ceramic-sale-invoice-items";

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function isNonNegativeFiniteNumber(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isPositiveFiniteNumber(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isFiniteNumber(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value);
}

function isStatus(value: unknown): value is SaleInvoiceStatus {
    return value === "draft" || value === "completed" || value === "cancelled";
}

function isDate(value: unknown): value is string {
    return typeof value === "string" && Number.isFinite(Date.parse(value));
}

export function parseStoredSaleInvoice(value: unknown): SaleInvoice | null {
    if (!isRecord(value)) return null;
    if (
        !isNonNegativeFiniteNumber(value.id) ||
        typeof value.invoiceNumber !== "string" ||
        !(value.customerId === null || isNonNegativeFiniteNumber(value.customerId)) ||
        typeof value.customerNameSnapshot !== "string" ||
        !(value.currency === "IQD" || value.currency === "USD") ||
        !isStatus(value.status) ||
        !isNonNegativeFiniteNumber(value.subtotal) ||
        !isNonNegativeFiniteNumber(value.discount) ||
        !isNonNegativeFiniteNumber(value.total) ||
        !isNonNegativeFiniteNumber(value.paidAmount) ||
        !isFiniteNumber(value.remainingAmount) ||
        typeof value.note !== "string" ||
        !isDate(value.createdAt) ||
        !isDate(value.updatedAt)
    ) return null;
    return {
        id: value.id,
        invoiceNumber: value.invoiceNumber,
        customerId: value.customerId,
        customerNameSnapshot: value.customerNameSnapshot,
        currency: value.currency,
        status: value.status,
        subtotal: value.subtotal,
        discount: value.discount,
        total: value.total,
        paidAmount: value.paidAmount,
        remainingAmount: value.remainingAmount,
        note: value.note,
        createdAt: value.createdAt,
        updatedAt: value.updatedAt,
        completedAt: isDate(value.completedAt) ? value.completedAt : null,
        completionTransactionId: isNonNegativeFiniteNumber(value.completionTransactionId)
            ? value.completionTransactionId : null,
        stockMovementIds: Array.isArray(value.stockMovementIds)
            ? value.stockMovementIds.filter(isNonNegativeFiniteNumber) : [],
        cancelledAt: isDate(value.cancelledAt) ? value.cancelledAt : null,
        cancellationReason:
            typeof value.cancellationReason === "string" ? value.cancellationReason : "",
        reversalStockMovementIds: Array.isArray(value.reversalStockMovementIds)
            ? value.reversalStockMovementIds.filter(isNonNegativeFiniteNumber) : [],
        reversedCustomerTransactionId:
            isNonNegativeFiniteNumber(value.reversedCustomerTransactionId)
                ? value.reversedCustomerTransactionId : null,
    };
}

export function parseStoredSaleInvoiceItem(value: unknown): SaleInvoiceItem | null {
    if (!isRecord(value)) return null;
    if (
        !isNonNegativeFiniteNumber(value.id) ||
        !isNonNegativeFiniteNumber(value.invoiceId) ||
        !isNonNegativeFiniteNumber(value.productId) ||
        typeof value.productCodeSnapshot !== "string" ||
        typeof value.productNameSnapshot !== "string" ||
        !(value.unit === "متر مربع" || value.unit === "قطعة") ||
        !isPositiveFiniteNumber(value.quantity) ||
        !isNonNegativeFiniteNumber(value.unitPrice) ||
        !isNonNegativeFiniteNumber(value.total)
    ) return null;
    return {
        id: value.id,
        invoiceId: value.invoiceId,
        productId: value.productId,
        productCodeSnapshot: value.productCodeSnapshot,
        productNameSnapshot: value.productNameSnapshot,
        unit: value.unit,
        quantity: value.quantity,
        unitPrice: value.unitPrice,
        total: value.total,
    };
}

function readArray<T>(
    storage: Pick<Storage, "getItem">,
    key: string,
    parser: (value: unknown) => T | null,
    fallback: readonly T[],
): T[] {
    try {
        const raw = storage.getItem(key);
        if (!raw) return [...fallback];
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed) || parsed.length === 0) return [...fallback];
        const valid = parsed.map(parser).filter((item): item is T => item !== null);
        return valid.length === parsed.length ? valid : [...fallback];
    } catch {
        return [...fallback];
    }
}

export function readStoredSaleInvoices(
    storage: Pick<Storage, "getItem"> = localStorage,
): SaleInvoice[] {
    return readArray(storage, SALES_INVOICES_STORAGE_KEY, parseStoredSaleInvoice, initialSaleInvoices);
}

export function readStoredSaleInvoiceItems(
    storage: Pick<Storage, "getItem"> = localStorage,
): SaleInvoiceItem[] {
    return readArray(storage, SALES_ITEMS_STORAGE_KEY, parseStoredSaleInvoiceItem, initialSaleInvoiceItems);
}

export function writeStoredSaleInvoices(
    invoices: readonly SaleInvoice[],
    storage: Pick<Storage, "setItem"> = localStorage,
): void {
    storage.setItem(SALES_INVOICES_STORAGE_KEY, JSON.stringify(invoices));
}

export function writeStoredSaleInvoiceItems(
    items: readonly SaleInvoiceItem[],
    storage: Pick<Storage, "setItem"> = localStorage,
): void {
    storage.setItem(SALES_ITEMS_STORAGE_KEY, JSON.stringify(items));
}
