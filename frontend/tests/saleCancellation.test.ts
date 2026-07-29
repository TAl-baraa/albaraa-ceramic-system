import assert from "node:assert/strict";
import test from "node:test";

import { buildSaleCancellationPlan } from "../src/services/saleCancellation.ts";
import type { CustomerTransaction } from "../src/types/customer.ts";
import type { Product } from "../src/types/product.ts";
import type {
    SaleInvoice,
    SaleInvoiceItem,
} from "../src/types/sale.ts";
import type { StockMovement } from "../src/types/stockMovement.ts";
import { getSalesSummary } from "../src/utils/salePresentation.ts";

const CANCELLED_AT = "2026-07-30T10:00:00.000Z";

const item: SaleInvoiceItem = {
    id: 1,
    invoiceId: 50,
    productId: 10,
    productCodeSnapshot: "CER-10",
    productNameSnapshot: "سيراميك تاريخي",
    unit: "متر مربع",
    quantity: 2,
    unitPrice: 10_000,
    total: 20_000,
};

const product: Product = {
    id: 10,
    code: "CER-10",
    name: "سيراميك حالي",
    size: "60×60",
    company: "النور",
    unit: "متر مربع",
    quantity: 8,
    minimumQuantity: 1,
    sellPriceIqd: 10_000,
    purchasePriceUsd: 5,
};

const originalMovement: StockMovement = {
    id: 500,
    productId: product.id,
    type: "out",
    quantity: 2,
    previousQuantity: 10,
    newQuantity: 8,
    note: "بيع بموجب الفاتورة INV-2026-004",
    createdAt: "2026-07-29T10:00:00.000Z",
    sourceType: "sale_invoice",
    sourceId: 50,
    sourceReference: "INV-2026-004",
};

function invoice(
    overrides: Partial<SaleInvoice> = {},
): SaleInvoice {
    return {
        id: 50,
        invoiceNumber: "INV-2026-004",
        customerId: 3,
        customerNameSnapshot: "أحمد",
        currency: "IQD",
        status: "completed",
        subtotal: 20_000,
        discount: 0,
        total: 20_000,
        paidAmount: 5_000,
        remainingAmount: 15_000,
        note: "snapshot note",
        createdAt: "2026-07-28T10:00:00.000Z",
        updatedAt: "2026-07-29T10:00:00.000Z",
        completedAt: "2026-07-29T10:00:00.000Z",
        completionTransactionId: 700,
        stockMovementIds: [originalMovement.id],
        cancelledAt: null,
        cancellationReason: "",
        reversalStockMovementIds: [],
        reversedCustomerTransactionId: null,
        ...overrides,
    };
}

function transaction(
    type: "debt" | "credit" = "debt",
    currency: "IQD" | "USD" = "IQD",
): CustomerTransaction {
    return {
        id: 700,
        customerId: 3,
        type,
        amount: 15_000,
        currency,
        note: "متبقي فاتورة البيع INV-2026-004",
        createdAt: "2026-07-29T10:00:00.000Z",
        recordedAt: "2026-07-29T10:00:00.000Z",
        balanceAfter: { IQD: 15_000, USD: 0 },
        status: "active",
        correctedTransactionId: null,
        voidedAt: null,
        voidReason: "",
        createdByCorrection: false,
        sourceType: "sale_invoice",
        sourceId: 50,
        sourceReference: "INV-2026-004",
    };
}

function cancel(
    currentInvoice = invoice(),
    currentItems: SaleInvoiceItem[] = [item],
    currentProducts: Product[] = [product],
    movements: StockMovement[] = [originalMovement],
    transactions: CustomerTransaction[] = [transaction()],
    reason = "طلب العميل",
) {
    return buildSaleCancellationPlan({
        invoice: currentInvoice,
        items: currentItems,
        products: currentProducts,
        stockMovements: movements,
        customerTransactions: transactions,
        reason,
        cancelledAt: CANCELLED_AT,
    });
}

test("completed invoice returns stock and retains invoice snapshots and totals", () => {
    const originalInvoice = invoice();
    const snapshot = structuredClone(item);
    const result = cancel(originalInvoice);

    assert.equal(result.success, true);
    if (!result.success) return;
    assert.equal(result.plan.updatedProducts[0]?.quantity, 10);
    assert.equal(result.plan.cancelledInvoice.total, 20_000);
    assert.equal(result.plan.cancelledInvoice.note, "snapshot note");
    assert.deepEqual(item, snapshot);
});

test("multiple products create multiple reversal movements", () => {
    const secondItem: SaleInvoiceItem = {
        ...item,
        id: 2,
        productId: 11,
        productCodeSnapshot: "DEC-11",
        productNameSnapshot: "ديكور",
        unit: "قطعة",
        quantity: 1,
        unitPrice: 5_000,
        total: 5_000,
    };
    const secondProduct: Product = {
        ...product,
        id: 11,
        code: "DEC-11",
        unit: "قطعة",
        quantity: 4,
    };
    const secondMovement: StockMovement = {
        ...originalMovement,
        id: 501,
        productId: 11,
        quantity: 1,
        previousQuantity: 5,
        newQuantity: 4,
    };
    const result = cancel(
        invoice({ stockMovementIds: [500, 501] }),
        [item, secondItem],
        [product, secondProduct],
        [originalMovement, secondMovement],
    );

    assert.equal(result.success, true);
    if (!result.success) return;
    assert.equal(result.plan.reversalStockMovements.length, 2);
});

test("original stock-out movement remains unchanged", () => {
    const movementSnapshot = structuredClone(originalMovement);
    const result = cancel();

    assert.equal(result.success, true);
    assert.deepEqual(originalMovement, movementSnapshot);
});

test("linked debt transaction is voided with cancellation audit reason", () => {
    const result = cancel();

    assert.equal(result.success, true);
    if (!result.success) return;
    assert.equal(
        result.plan.voidedCustomerTransaction?.status,
        "voided",
    );
    assert.match(
        result.plan.voidedCustomerTransaction?.voidReason ?? "",
        /INV-2026-004: طلب العميل/,
    );
});

test("linked credit transaction is voided without opposite transaction", () => {
    const result = cancel(
        invoice({
            currency: "USD",
            paidAmount: 25_000,
            remainingAmount: -5_000,
        }),
        [item],
        [product],
        [originalMovement],
        [transaction("credit", "USD")],
    );

    assert.equal(result.success, true);
    if (!result.success) return;
    assert.equal(
        result.plan.voidedCustomerTransaction?.type,
        "credit",
    );
    assert.equal(
        result.plan.voidedCustomerTransaction?.currency,
        "USD",
    );
});

test("fully paid invoice changes no customer transaction", () => {
    const result = cancel(
        invoice({
            paidAmount: 20_000,
            remainingAmount: 0,
            completionTransactionId: null,
        }),
        [item],
        [product],
        [originalMovement],
        [],
    );

    assert.equal(result.success, true);
    if (!result.success) return;
    assert.equal(result.plan.voidedCustomerTransaction, null);
});

test("cash sale changes no customer account", () => {
    const result = cancel(
        invoice({
            customerId: null,
            customerNameSnapshot: "بيع نقدي",
            paidAmount: 20_000,
            remainingAmount: 0,
            completionTransactionId: null,
        }),
        [item],
        [product],
        [originalMovement],
        [],
    );

    assert.equal(result.success, true);
    if (!result.success) return;
    assert.equal(result.plan.voidedCustomerTransaction, null);
});

test("missing product blocks every reversal operation", () => {
    const movements = [originalMovement];
    const transactions = [transaction()];
    const snapshots = structuredClone({ movements, transactions });
    const result = cancel(
        invoice(),
        [item],
        [],
        movements,
        transactions,
    );

    assert.equal(result.success, false);
    assert.deepEqual({ movements, transactions }, snapshots);
});

test("already cancelled and duplicate cancellation are rejected", () => {
    assert.equal(
        cancel(
            invoice({
                status: "cancelled",
                cancelledAt: CANCELLED_AT,
            }),
        ).success,
        false,
    );
    assert.equal(
        cancel(
            invoice({
                reversalStockMovementIds: [900],
            }),
        ).success,
        false,
    );
});

test("cancelled invoices are excluded from completed summary totals", () => {
    const summary = getSalesSummary(
        [
            invoice(),
            invoice({
                id: 51,
                invoiceNumber: "INV-2026-005",
                status: "cancelled",
            }),
        ],
        "IQD",
    );

    assert.equal(summary.invoiceCount, 2);
    assert.equal(summary.completedCount, 1);
    assert.equal(summary.completedSales, 20_000);
    assert.equal(summary.completedRemaining, 15_000);
});

test("IQD and USD cancellation effects stay independent", () => {
    const iqd = cancel();
    const usd = cancel(
        invoice({ currency: "USD" }),
        [item],
        [product],
        [originalMovement],
        [transaction("debt", "USD")],
    );

    assert.equal(iqd.success, true);
    assert.equal(usd.success, true);
    if (!iqd.success || !usd.success) return;
    assert.equal(
        iqd.plan.voidedCustomerTransaction?.currency,
        "IQD",
    );
    assert.equal(
        usd.plan.voidedCustomerTransaction?.currency,
        "USD",
    );
});

test("reversal source uses invoice number and cancellation reason is required", () => {
    const result = cancel();

    assert.equal(result.success, true);
    if (!result.success) return;
    assert.equal(
        result.plan.reversalStockMovements[0]?.sourceType,
        "sale_invoice_cancellation",
    );
    assert.equal(
        result.plan.reversalStockMovements[0]?.sourceReference,
        "INV-2026-004",
    );
    const missingReason = cancel(
        invoice(),
        [item],
        [product],
        [originalMovement],
        [transaction()],
        " ",
    );
    assert.equal(missingReason.success, false);
});
