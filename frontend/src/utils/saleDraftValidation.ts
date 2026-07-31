import type { SaleDraftInput, SaleDraftItemInput } from "../types/sale";
import { calculateInvoiceTotals, calculateSubtotal } from "./salesCalculations.ts";

export class SaleDraftValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "SaleDraftValidationError";
    }
}

export function mergeSaleDraftItems(
    items: readonly SaleDraftItemInput[],
): SaleDraftItemInput[] {
    const merged = new Map<number, SaleDraftItemInput>();
    const order: number[] = [];
    for (const item of items) {
        if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
            throw new SaleDraftValidationError("Quantity must be greater than zero");
        }
        if (!Number.isFinite(item.unitPrice) || item.unitPrice <= 0) {
            throw new SaleDraftValidationError("Unit price must be greater than zero");
        }
        if (item.unit === "قطعة" && !Number.isInteger(item.quantity)) {
            throw new SaleDraftValidationError("Piece quantity must be a whole number");
        }
        const existing = merged.get(item.productId);
        if (!existing) {
            merged.set(item.productId, { ...item });
            order.push(item.productId);
            continue;
        }
        if (existing.unitPrice !== item.unitPrice) {
            throw new SaleDraftValidationError(
                "Duplicate product items have conflicting unit prices",
            );
        }
        if (existing.unit && item.unit && existing.unit !== item.unit) {
            throw new SaleDraftValidationError("Duplicate product units conflict");
        }
        merged.set(item.productId, {
            ...existing,
            quantity: Number((existing.quantity + item.quantity).toFixed(6)),
        });
    }
    return order.map((productId) => merged.get(productId)!);
}

export function validateSaleDraft(input: SaleDraftInput): SaleDraftInput {
    if (input.items.length === 0) {
        throw new SaleDraftValidationError("At least one invoice item is required");
    }
    if (!Number.isFinite(input.discount) || input.discount < 0) {
        throw new SaleDraftValidationError("Discount must be nonnegative");
    }
    if (!Number.isFinite(input.paidAmount) || input.paidAmount < 0) {
        throw new SaleDraftValidationError("Paid amount must be nonnegative");
    }
    const items = mergeSaleDraftItems(input.items);
    const subtotal = calculateSubtotal(items);
    if (input.discount > subtotal) {
        throw new SaleDraftValidationError("Discount cannot exceed subtotal");
    }
    calculateInvoiceTotals(subtotal, input.discount, input.paidAmount);
    return { ...input, items };
}
