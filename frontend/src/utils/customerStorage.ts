import type {
    Currency,
    CustomerTransaction,
    CustomerTransactionType,
} from "../types/customer";

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
        // Persisted snapshots are derived data and may be stale or incorrect.
        balanceAfter: { IQD: 0, USD: 0 },
    };
}
