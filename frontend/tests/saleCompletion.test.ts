import assert from "node:assert/strict";
import test from "node:test";

import { buildSaleCompletionPlan } from "../src/services/saleCompletion.ts";
import type { Customer } from "../src/types/customer.ts";
import type { Product } from "../src/types/product.ts";
import type {
    SaleInvoice,
    SaleInvoiceItem,
} from "../src/types/sale.ts";

const COMPLETED_AT = "2026-07-29T10:00:00.000Z";

const customer: Customer = {
    id: 10,
    name: "أحمد",
    phone: "",
    address: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    lastPaymentAt: null,
    notes: "",
};

const products: Product[] = [
    {
        id: 1,
        code: "CER-1",
        name: "سيراميك",
        size: "60×60",
        company: "النور",
        unit: "متر مربع",
        quantity: 10,
        minimumQuantity: 1,
        sellPriceIqd: 10_000,
        purchasePriceUsd: 5,
    },
    {
        id: 2,
        code: "DEC-1",
        name: "ديكور",
        size: "30×30",
        company: "النور",
        unit: "قطعة",
        quantity: 5,
        minimumQuantity: 1,
        sellPriceIqd: 5_000,
        purchasePriceUsd: 2,
    },
];

function item(
    productId = 1,
    quantity = 2,
    unitPrice = 10_000,
): SaleInvoiceItem {
    const product = products.find(
        (currentProduct) => currentProduct.id === productId,
    )!;

    return {
        id: 100 + productId,
        invoiceId: 50,
        productId,
        productCodeSnapshot: product.code,
        productNameSnapshot: product.name,
        unit: product.unit,
        quantity,
        unitPrice,
        total: quantity * unitPrice,
    };
}

function invoice(
    overrides: Partial<SaleInvoice> = {},
): SaleInvoice {
    return {
        id: 50,
        invoiceNumber: "INV-2026-004",
        customerId: customer.id,
        customerNameSnapshot: customer.name,
        currency: "IQD",
        status: "draft",
        subtotal: 20_000,
        discount: 0,
        total: 20_000,
        paidAmount: 5_000,
        remainingAmount: 15_000,
        note: "",
        createdAt: "2026-07-28T10:00:00.000Z",
        updatedAt: "2026-07-28T10:00:00.000Z",
        completedAt: null,
        completionTransactionId: null,
        stockMovementIds: [],
        ...overrides,
    };
}

function plan(
    currentInvoice: SaleInvoice,
    items: SaleInvoiceItem[] = [item()],
    currentProducts: Product[] = products,
) {
    return buildSaleCompletionPlan({
        invoice: currentInvoice,
        invoices: [currentInvoice],
        items,
        products: currentProducts,
        customers: [customer],
        stockMovements: [],
        customerTransactions: [],
        completedAt: COMPLETED_AT,
    });
}

test("completed invoice deducts stock and preserves item snapshots", () => {
    const items = [item()];
    const snapshot = structuredClone(items);
    const result = plan(invoice(), items);

    assert.equal(result.success, true);
    if (!result.success) return;
    assert.equal(result.plan.updatedProducts[0]?.quantity, 8);
    assert.equal(result.plan.completedInvoice.status, "completed");
    assert.deepEqual(items, snapshot);
});

test("multiple products produce multiple linked stock movements", () => {
    const secondItem = item(2, 2, 5_000);
    const result = plan(
        invoice({
            subtotal: 30_000,
            total: 30_000,
            remainingAmount: 25_000,
        }),
        [item(), secondItem],
    );

    assert.equal(result.success, true);
    if (!result.success) return;
    assert.equal(result.plan.stockMovements.length, 2);
    assert.ok(
        result.plan.stockMovements.every(
            (movement) =>
                movement.sourceReference === "INV-2026-004" &&
                movement.note.includes("INV-2026-004"),
        ),
    );
});

test("insufficient stock produces no input changes", () => {
    const currentProducts = structuredClone(products);
    const snapshot = structuredClone(currentProducts);
    const result = plan(invoice(), [item(1, 11)], currentProducts);

    assert.equal(result.success, false);
    assert.deepEqual(currentProducts, snapshot);
});

test("remaining balance creates one debt", () => {
    const result = plan(invoice());

    assert.equal(result.success, true);
    if (!result.success) return;
    assert.equal(result.plan.customerTransaction?.type, "debt");
    assert.equal(result.plan.customerTransaction?.amount, 15_000);
});

test("fully paid invoice creates no customer transaction", () => {
    const result = plan(
        invoice({ paidAmount: 20_000, remainingAmount: 0 }),
    );

    assert.equal(result.success, true);
    if (!result.success) return;
    assert.equal(result.plan.customerTransaction, null);
});

test("overpayment creates credit in exact invoice currency", () => {
    const result = plan(
        invoice({
            currency: "USD",
            subtotal: 20_000,
            total: 20_000,
            paidAmount: 20_050,
            remainingAmount: -50,
        }),
    );

    assert.equal(result.success, true);
    if (!result.success) return;
    assert.equal(result.plan.customerTransaction?.type, "credit");
    assert.equal(result.plan.customerTransaction?.currency, "USD");
    assert.equal(result.plan.customerTransaction?.amount, 50);
});

test("cash sale with unpaid remainder is rejected", () => {
    const result = plan(
        invoice({
            customerId: null,
            customerNameSnapshot: "بيع نقدي",
        }),
    );

    assert.equal(result.success, false);
});

test("cash sale fully paid completes without customer transaction", () => {
    const result = plan(
        invoice({
            customerId: null,
            customerNameSnapshot: "بيع نقدي",
            paidAmount: 20_000,
            remainingAmount: 0,
        }),
    );

    assert.equal(result.success, true);
    if (!result.success) return;
    assert.equal(result.plan.customerTransaction, null);
});

test("piece quantities must be integers", () => {
    const pieceItem = item(2, 1.5, 5_000);
    const result = plan(
        invoice({
            subtotal: 7_500,
            total: 7_500,
            paidAmount: 0,
            remainingAmount: 7_500,
        }),
        [pieceItem],
    );

    assert.equal(result.success, false);
});

test("square-meter decimal quantity is accepted", () => {
    const decimalItem = item(1, 1.5, 10_000);
    const result = plan(
        invoice({
            subtotal: 15_000,
            total: 15_000,
            paidAmount: 0,
            remainingAmount: 15_000,
        }),
        [decimalItem],
    );

    assert.equal(result.success, true);
});

test("duplicate finalization is rejected", () => {
    const result = plan(invoice({ status: "completed" }));

    assert.equal(result.success, false);
});

test("IQD and USD effects remain independent", () => {
    const iqdResult = plan(invoice());
    const usdResult = plan(
        invoice({
            currency: "USD",
            paidAmount: 5_000,
            remainingAmount: 15_000,
        }),
    );

    assert.equal(iqdResult.success, true);
    assert.equal(usdResult.success, true);
    if (!iqdResult.success || !usdResult.success) return;
    assert.equal(iqdResult.plan.customerTransaction?.currency, "IQD");
    assert.equal(usdResult.plan.customerTransaction?.currency, "USD");
});

test("source references use invoice number without exposing IDs", () => {
    const result = plan(invoice());

    assert.equal(result.success, true);
    if (!result.success) return;
    assert.equal(
        result.plan.customerTransaction?.sourceReference,
        "INV-2026-004",
    );
    assert.equal(
        result.plan.stockMovements[0]?.sourceReference,
        "INV-2026-004",
    );
});
