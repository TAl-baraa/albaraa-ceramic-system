import assert from "node:assert/strict";
import test from "node:test";

import type { SaleInvoiceItem } from "../src/types/sale.ts";
import {
    calculateInvoiceTotals,
    calculateLineTotal,
    calculateSubtotal,
    generateNextInvoiceNumber,
    mergeDraftItem,
    validateSaleQuantity,
} from "../src/utils/salesCalculations.ts";

function item(
    id: number,
    productId: number,
    quantity: number,
    unitPrice: number,
): SaleInvoiceItem {
    return {
        id,
        invoiceId: 1,
        productId,
        productCodeSnapshot: `P-${productId}`,
        productNameSnapshot: `Product ${productId}`,
        unit: "متر مربع",
        quantity,
        unitPrice,
        total: calculateLineTotal(quantity, unitPrice),
    };
}

test("calculates line totals and subtotal", () => {
    assert.equal(calculateLineTotal(2.5, 12_000), 30_000);
    assert.equal(
        calculateSubtotal([
            item(1, 1, 2.5, 12_000),
            item(2, 2, 3, 5_000),
        ]),
        45_000,
    );
});

test("calculates discount, final total, and remaining amount", () => {
    assert.deepEqual(
        calculateInvoiceTotals(100_000, 10_000, 25_000),
        {
            subtotal: 100_000,
            discount: 10_000,
            total: 90_000,
            paidAmount: 25_000,
            remainingAmount: 65_000,
            overpayment: 0,
        },
    );
});

test("calculates overpayment", () => {
    assert.deepEqual(
        calculateInvoiceTotals(100, 10, 120),
        {
            subtotal: 100,
            discount: 10,
            total: 90,
            paidAmount: 120,
            remainingAmount: -30,
            overpayment: 30,
        },
    );
});

test("validates integer pieces and decimal square meters", () => {
    assert.equal(
        validateSaleQuantity(1.5, "قطعة", 10),
        "كمية القطع يجب أن تكون عددًا صحيحًا.",
    );
    assert.equal(
        validateSaleQuantity(1.5, "متر مربع", 10),
        null,
    );
    assert.equal(
        validateSaleQuantity(11, "متر مربع", 10),
        "الكمية المطلوبة أكبر من الكمية المتوفرة.",
    );
});

test("merges duplicate products without duplicating lines", () => {
    const merged = mergeDraftItem(
        [item(1, 7, 2, 10)],
        item(2, 7, 3, 99),
    );

    assert.equal(merged.length, 1);
    assert.equal(merged[0]?.quantity, 5);
    assert.equal(merged[0]?.unitPrice, 10);
    assert.equal(merged[0]?.total, 50);
});

test("generates the next unique invoice number for the year", () => {
    assert.equal(
        generateNextInvoiceNumber(
            [
                { invoiceNumber: "INV-2026-001" },
                { invoiceNumber: "INV-2026-014" },
                { invoiceNumber: "INV-2025-099" },
                { invoiceNumber: "OTHER" },
            ],
            2026,
        ),
        "INV-2026-015",
    );
});
