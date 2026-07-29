import assert from "node:assert/strict";
import test from "node:test";

import type { CustomerTransaction } from "../src/types/customer.ts";
import type { Product } from "../src/types/product.ts";
import type { SaleInvoice } from "../src/types/sale.ts";
import {
    getDashboardActivities,
    getDashboardCustomerSummary,
    getDashboardSalesSummary,
    getInventoryWarnings,
    isSameLocalDay,
} from "../src/utils/dashboardCalculations.ts";

const now = new Date(2026, 6, 29, 15, 0);

function invoice(
    id: number,
    status: SaleInvoice["status"],
    currency: SaleInvoice["currency"] = "IQD",
): SaleInvoice {
    return {
        id,
        invoiceNumber: `INV-2026-${String(id).padStart(3, "0")}`,
        customerId: 1,
        customerNameSnapshot: "براء",
        currency,
        status,
        subtotal: 100,
        discount: 0,
        total: 100,
        paidAmount: 60,
        remainingAmount: 40,
        note: "",
        createdAt: new Date(2026, 6, 28, 10).toISOString(),
        updatedAt: new Date(2026, 6, 29, 10).toISOString(),
        completedAt:
            status === "draft"
                ? null
                : new Date(2026, 6, 29, 10).toISOString(),
        completionTransactionId: null,
        stockMovementIds: [],
        cancelledAt:
            status === "cancelled"
                ? new Date(2026, 6, 29, 12).toISOString()
                : null,
        cancellationReason: "",
        reversalStockMovementIds: [],
        reversedCustomerTransactionId: null,
    };
}

function transaction(
    id: number,
    type: CustomerTransaction["type"],
    amount: number,
    status: CustomerTransaction["status"] = "active",
): CustomerTransaction {
    return {
        id,
        customerId: 1,
        type,
        amount,
        currency: "IQD",
        note: "ملاحظة",
        createdAt: new Date(2026, 6, 29, 11).toISOString(),
        recordedAt: new Date(2026, 6, 29, 11).toISOString(),
        balanceAfter: { IQD: 999, USD: 999 },
        status,
        correctedTransactionId: null,
        voidedAt:
            status === "voided"
                ? new Date(2026, 6, 29, 13).toISOString()
                : null,
        voidReason: status === "voided" ? "ملغاة" : "",
        createdByCorrection: false,
        sourceType: "manual",
        sourceId: null,
        sourceReference: "",
    };
}

const product = (
    id: number,
    quantity: number,
    minimumQuantity: number,
): Product => ({
    id,
    code: `P${id}`,
    name: `منتج ${id}`,
    size: "60×60",
    company: "شركة",
    unit: "متر مربع",
    quantity,
    minimumQuantity,
    sellPriceIqd: 1,
    purchasePriceUsd: 1,
});

test("sales summary excludes drafts and cancelled invoices", () => {
    const summary = getDashboardSalesSummary(
        [invoice(1, "completed"), invoice(2, "draft"), invoice(3, "cancelled")],
        "IQD",
        now,
    );
    assert.deepEqual(summary, {
        todaySales: 100,
        monthlySales: 100,
        remainingTotal: 40,
        completedCount: 1,
    });
});

test("today and month use local calendar fields", () => {
    assert.equal(
        isSameLocalDay(new Date(2026, 6, 29, 0, 1), now),
        true,
    );
    const older = invoice(1, "completed");
    older.completedAt = new Date(2026, 6, 1, 12).toISOString();
    const summary = getDashboardSalesSummary([older], "IQD", now);
    assert.equal(summary.todaySales, 0);
    assert.equal(summary.monthlySales, 100);
});

test("remaining totals add positives without subtracting overpayments", () => {
    const overpaid = invoice(2, "completed");
    overpaid.remainingAmount = -25;
    const summary = getDashboardSalesSummary(
        [invoice(1, "completed"), overpaid],
        "IQD",
        now,
    );
    assert.equal(summary.remainingTotal, 40);
});

test("IQD and USD sales remain independent", () => {
    assert.equal(
        getDashboardSalesSummary(
            [invoice(1, "completed"), invoice(2, "completed", "USD")],
            "USD",
            now,
        ).monthlySales,
        100,
    );
});

test("customer summary uses active net balances, not snapshots", () => {
    const customers = [{
        id: 1,
        name: "براء",
        phone: "",
        address: "",
        createdAt: now.toISOString(),
        lastPaymentAt: null,
        notes: "",
    }];
    assert.deepEqual(
        getDashboardCustomerSummary(
            customers,
            [
                transaction(1, "debt", 100),
                transaction(2, "payment_received", 20),
                transaction(3, "debt", 500, "voided"),
            ],
            "IQD",
        ),
        { receivables: 80, payables: 0 },
    );
    assert.deepEqual(
        getDashboardCustomerSummary(
            customers,
            [transaction(4, "credit", 30)],
            "IQD",
        ),
        { receivables: 0, payables: 30 },
    );
});

test("out of stock warnings precede the lowest relative stock", () => {
    const warnings = getInventoryWarnings([
        product(1, 2, 10),
        product(2, 0, 5),
        product(3, 8, 10),
    ]);
    assert.deepEqual(
        warnings.map((entry) => entry.id),
        [2, 1, 3],
    );
});

test("activities are newest first and labels do not expose raw IDs", () => {
    const sale = invoice(1785243718470, "completed");
    sale.invoiceNumber = "INV-2026-004";
    const activities = getDashboardActivities({
        invoices: [sale],
        products: [],
        stockMovements: [],
        customers: [],
        transactions: [transaction(1785243718471, "debt", 10)],
    });
    assert.equal(activities[0]?.kind, "customer");
    assert.equal(
        activities.some((activity) =>
            activity.title.includes("178524371847"),
        ),
        false,
    );
});

test("empty inputs return safe zero and empty values", () => {
    assert.deepEqual(getDashboardSalesSummary([], "IQD", now), {
        todaySales: 0,
        monthlySales: 0,
        remainingTotal: 0,
        completedCount: 0,
    });
    assert.deepEqual(getInventoryWarnings([]), []);
    assert.deepEqual(
        getDashboardActivities({
            invoices: [],
            products: [],
            stockMovements: [],
            customers: [],
            transactions: [],
        }),
        [],
    );
});
