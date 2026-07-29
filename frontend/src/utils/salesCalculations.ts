import type { ProductUnit } from "../types/product";
import type {
    SaleInvoice,
    SaleInvoiceItem,
} from "../types/sale";

function normalizeAmount(amount: number) {
    return Number(amount.toFixed(6));
}

export function calculateLineTotal(
    quantity: number,
    unitPrice: number,
) {
    return normalizeAmount(quantity * unitPrice);
}

export function calculateSubtotal(
    items: readonly Pick<
        SaleInvoiceItem,
        "quantity" | "unitPrice"
    >[],
) {
    return normalizeAmount(
        items.reduce(
            (total, item) =>
                total +
                calculateLineTotal(item.quantity, item.unitPrice),
            0,
        ),
    );
}

export function calculateInvoiceTotals(
    subtotal: number,
    discount: number,
    paidAmount: number,
) {
    const total = normalizeAmount(
        Math.max(0, subtotal - discount),
    );
    const remainingAmount = normalizeAmount(total - paidAmount);

    return {
        subtotal: normalizeAmount(subtotal),
        discount: normalizeAmount(discount),
        total,
        paidAmount: normalizeAmount(paidAmount),
        remainingAmount,
        overpayment: normalizeAmount(
            Math.max(0, -remainingAmount),
        ),
    };
}

export function validateSaleQuantity(
    quantity: number,
    unit: ProductUnit,
    availableQuantity: number,
): string | null {
    if (!Number.isFinite(quantity) || quantity <= 0) {
        return "يجب أن تكون الكمية أكبر من صفر.";
    }

    if (unit === "قطعة" && !Number.isInteger(quantity)) {
        return "كمية القطع يجب أن تكون عددًا صحيحًا.";
    }

    if (quantity > availableQuantity) {
        return "الكمية المطلوبة أكبر من الكمية المتوفرة.";
    }

    return null;
}

export function mergeDraftItem(
    items: readonly SaleInvoiceItem[],
    newItem: SaleInvoiceItem,
): SaleInvoiceItem[] {
    const existingItem = items.find(
        (item) => item.productId === newItem.productId,
    );

    if (!existingItem) {
        return [...items, newItem];
    }

    const quantity = normalizeAmount(
        existingItem.quantity + newItem.quantity,
    );

    return items.map((item) =>
        item.productId === newItem.productId
            ? {
                  ...item,
                  quantity,
                  total: calculateLineTotal(
                      quantity,
                      item.unitPrice,
                  ),
              }
            : item,
    );
}

export function generateNextInvoiceNumber(
    invoices: readonly Pick<SaleInvoice, "invoiceNumber">[],
    year: number,
) {
    const prefix = `INV-${year}-`;
    const highestSequence = invoices.reduce((highest, invoice) => {
        if (!invoice.invoiceNumber.startsWith(prefix)) {
            return highest;
        }

        const sequence = Number(
            invoice.invoiceNumber.slice(prefix.length),
        );

        return Number.isInteger(sequence) && sequence > highest
            ? sequence
            : highest;
    }, 0);

    return `${prefix}${String(highestSequence + 1).padStart(3, "0")}`;
}
