import type {
    Currency,
    Customer,
    CustomerTransaction,
    CustomerTransactionType,
} from "../types/customer";

export const CUSTOMERS_STORAGE_KEY = "albaraa-ceramic-customers";
export const CUSTOMER_TRANSACTIONS_STORAGE_KEY =
    "albaraa-ceramic-customer-transactions";

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

function isCurrency(value: unknown): value is Currency {
    return value === "IQD" || value === "USD";
}

function isTransactionType(
    value: unknown,
): value is CustomerTransactionType {
    return (
        value === "debt" ||
        value === "credit" ||
        value === "payment_received" ||
        value === "payment_paid" ||
        value === "adjustment"
    );
}

function isValidDate(value: unknown): value is string {
    return (
        typeof value === "string" &&
        Number.isFinite(Date.parse(value))
    );
}

export function parseStoredCustomer(value: unknown): Customer | null {
    if (!isRecord(value)) return null;
    if (
        !isFiniteNonNegativeNumber(value.id) ||
        typeof value.name !== "string" ||
        typeof value.phone !== "string" ||
        typeof value.address !== "string" ||
        !isValidDate(value.createdAt) ||
        !(value.lastPaymentAt === null || isValidDate(value.lastPaymentAt)) ||
        typeof value.notes !== "string"
    ) {
        return null;
    }
    return {
        id: value.id,
        name: value.name,
        phone: value.phone,
        address: value.address,
        createdAt: value.createdAt,
        lastPaymentAt: value.lastPaymentAt,
        notes: value.notes,
    };
}

export function loadStoredArray<T>(
    storage: Pick<Storage, "getItem">,
    storageKey: string,
    parser: (value: unknown) => T | null,
): T[] {
    try {
        const raw = storage.getItem(storageKey);
        if (!raw) return [];
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.map(parser).filter((item): item is T => item !== null);
    } catch {
        return [];
    }
}

export function readStoredCustomers(
    storage: Pick<Storage, "getItem"> = localStorage,
): Customer[] {
    return loadStoredArray(storage, CUSTOMERS_STORAGE_KEY, parseStoredCustomer);
}

export function readStoredCustomerTransactions(
    storage: Pick<Storage, "getItem"> = localStorage,
): CustomerTransaction[] {
    return loadStoredArray(
        storage,
        CUSTOMER_TRANSACTIONS_STORAGE_KEY,
        parseStoredCustomerTransaction,
    );
}

export function writeStoredCustomers(
    customers: readonly Customer[],
    storage: Pick<Storage, "setItem"> = localStorage,
): void {
    storage.setItem(CUSTOMERS_STORAGE_KEY, JSON.stringify(customers));
}

export function writeStoredCustomerTransactions(
    transactions: readonly CustomerTransaction[],
    storage: Pick<Storage, "setItem"> = localStorage,
): void {
    storage.setItem(CUSTOMER_TRANSACTIONS_STORAGE_KEY, JSON.stringify(transactions));
}

function parsePositiveAmount(value: unknown): number | null {
    if (
        typeof value !== "number" &&
        typeof value !== "string"
    ) {
        return null;
    }

    if (typeof value === "string" && value.trim() === "") {
        return null;
    }

    const amount = Number(value);

    return Number.isFinite(amount) && amount > 0 ? amount : null;
}

export function parseStoredCustomerTransaction(
    value: unknown,
): CustomerTransaction | null {
    if (!isRecord(value)) {
        return null;
    }

    const amount = parsePositiveAmount(value.amount);
    const status =
        value.status === "voided" ? "voided" : "active";
    const correctedTransactionId =
        isFiniteNonNegativeNumber(value.correctedTransactionId)
            ? value.correctedTransactionId
            : null;
    const voidedAt =
        value.voidedAt === null || value.voidedAt === undefined
            ? null
            : isValidDate(value.voidedAt)
              ? value.voidedAt
              : null;

    if (
        !isFiniteNonNegativeNumber(value.id) ||
        !isFiniteNonNegativeNumber(value.customerId) ||
        !isTransactionType(value.type) ||
        amount === null ||
        !isCurrency(value.currency) ||
        typeof value.note !== "string" ||
        !isValidDate(value.createdAt)
    ) {
        return null;
    }

    return {
        id: value.id,
        customerId: value.customerId,
        type: value.type,
        amount,
        currency: value.currency,
        note: value.note,
        createdAt: value.createdAt,
        recordedAt: isValidDate(value.recordedAt)
            ? value.recordedAt
            : value.createdAt,
        // Persisted snapshots are derived data and may be stale or incorrect.
        balanceAfter: { IQD: 0, USD: 0 },
        status,
        correctedTransactionId,
        voidedAt,
        voidReason:
            typeof value.voidReason === "string"
                ? value.voidReason
                : "",
        createdByCorrection:
            typeof value.createdByCorrection === "boolean"
                ? value.createdByCorrection
                : false,
        sourceType:
            value.sourceType === "sale_invoice"
                ? "sale_invoice"
                : "manual",
        sourceId: isFiniteNonNegativeNumber(value.sourceId)
            ? value.sourceId
            : null,
        sourceReference:
            typeof value.sourceReference === "string"
                ? value.sourceReference
                : "",
    };
}
