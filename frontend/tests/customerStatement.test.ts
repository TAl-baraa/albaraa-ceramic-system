import assert from "node:assert/strict";
import test from "node:test";

import type {
    Currency,
    CustomerTransaction,
} from "../src/types/customer.ts";
import type {
    SaleInvoice,
    SaleInvoiceItem,
} from "../src/types/sale.ts";
import {
    buildCustomerStatement,
    getStatementBalanceLabel,
} from "../src/utils/customerStatement.ts";

const customer = {
    id: 1,
    name: "براء",
    phone: "07700000000",
    address: "بغداد",
    createdAt: "2026-01-01T08:00:00.000Z",
    lastPaymentAt: null,
    notes: "",
};

function invoice(
    id: number,
    remainingAmount = 40,
    status: SaleInvoice["status"] = "completed",
    currency: Currency = "IQD",
): SaleInvoice {
    return {
        id,
        invoiceNumber: `INV-2026-${String(id).padStart(3, "0")}`,
        customerId: customer.id,
        customerNameSnapshot: customer.name,
        currency,
        status,
        subtotal: 100,
        discount: 0,
        total: 100,
        paidAmount: 100 - remainingAmount,
        remainingAmount,
        note: "فاتورة",
        createdAt: `2026-01-${String(id).padStart(2, "0")}T10:00:00.000Z`,
        updatedAt: `2026-01-${String(id).padStart(2, "0")}T10:00:00.000Z`,
        completedAt: `2026-01-${String(id).padStart(2, "0")}T10:00:00.000Z`,
        completionTransactionId: remainingAmount === 0 ? null : id + 100,
        stockMovementIds: [],
        cancelledAt:
            status === "cancelled"
                ? `2026-01-${String(id + 1).padStart(2, "0")}T10:00:00.000Z`
                : null,
        cancellationReason:
            status === "cancelled" ? "إلغاء تجريبي" : "",
        reversalStockMovementIds: [],
        reversedCustomerTransactionId:
            status === "cancelled" ? id + 100 : null,
    };
}

function item(
    invoiceId: number,
    index: number,
): SaleInvoiceItem {
    return {
        id: invoiceId * 10 + index,
        invoiceId,
        productId: 900 + index,
        productCodeSnapshot: `P-${index}`,
        productNameSnapshot: `منتج تاريخي ${index}`,
        unit: index % 2 === 0 ? "قطعة" : "متر مربع",
        quantity: index,
        unitPrice: 25,
        total: index * 25,
    };
}

function transaction(
    id: number,
    type: CustomerTransaction["type"],
    amount: number,
    overrides: Partial<CustomerTransaction> = {},
): CustomerTransaction {
    return {
        id,
        customerId: customer.id,
        type,
        amount,
        currency: "IQD",
        note: "حركة يدوية",
        createdAt: `2026-01-${String(id).padStart(2, "0")}T12:00:00.000Z`,
        recordedAt: `2026-01-${String(id).padStart(2, "0")}T12:00:00.000Z`,
        balanceAfter: { IQD: 999, USD: 999 },
        status: "active",
        correctedTransactionId: null,
        voidedAt: null,
        voidReason: "",
        createdByCorrection: false,
        sourceType: "manual",
        sourceId: null,
        sourceReference: "",
        ...overrides,
    };
}

function build(
    invoices: SaleInvoice[] = [],
    transactions: CustomerTransaction[] = [],
    items: SaleInvoiceItem[] = [],
    options: {
        currency?: Currency;
        startDate?: Date;
        endDate?: Date;
        showVoided?: boolean;
    } = {},
) {
    return buildCustomerStatement({
        customer,
        currency: options.currency ?? "IQD",
        invoices,
        invoiceItems: items,
        transactions,
        startDate: options.startDate,
        endDate: options.endDate,
        showVoided: options.showVoided,
    });
}

test("currency selection isolates IQD and USD", () => {
    const statement = build(
        [invoice(2, 10, "completed", "IQD"), invoice(3, 20, "completed", "USD")],
        [],
        [],
        { currency: "USD" },
    );
    assert.equal(statement.entries.length, 1);
    assert.equal(statement.finalBalance, 20);
});

test("completed partially paid invoice appears once", () => {
    const sale = invoice(2, 40);
    const linked = transaction(102, "debt", 40, {
        sourceType: "sale_invoice",
        sourceId: sale.id,
        sourceReference: sale.invoiceNumber,
    });
    const statement = build([sale], [linked]);
    assert.equal(statement.entries.length, 1);
    assert.equal(statement.entries[0]?.type, "invoice");
});

test("invoice product details remain attached to their invoice entry", () => {
    const sale = invoice(2);
    const statement = build([sale], [], [item(2, 1), item(2, 2)]);
    assert.equal(statement.entries[0]?.invoiceItems.length, 2);
    assert.equal(
        statement.entries[0]?.invoiceItems[0]?.productNameSnapshot,
        "منتج تاريخي 1",
    );
});

test("four invoice items produce four detail rows", () => {
    const sale = invoice(2);
    const items = [1, 2, 3, 4].map((index) => item(2, index));
    assert.equal(build([sale], [], items).entries[0]?.invoiceItems.length, 4);
});

test("fully paid customer invoice appears with zero account effect", () => {
    const statement = build([invoice(2, 0)]);
    assert.equal(statement.entries[0]?.effect, 0);
    assert.equal(statement.finalBalance, 0);
});

test("overpaid invoice appears as customer credit", () => {
    const statement = build([invoice(2, -25)]);
    assert.equal(statement.entries[0]?.credit, 25);
    assert.equal(statement.finalBalance, -25);
});

test("linked debt transaction is not duplicated", () => {
    const sale = invoice(2, 40);
    const linked = transaction(102, "debt", 40, {
        sourceType: "sale_invoice",
        sourceId: sale.id,
        sourceReference: sale.invoiceNumber,
    });
    assert.equal(build([sale], [linked]).finalBalance, 40);
});

test("manual payment appears separately", () => {
    const statement = build(
        [invoice(2, 40)],
        [transaction(3, "payment_received", 10)],
    );
    assert.equal(statement.entries.length, 2);
    assert.equal(statement.entries[1]?.description, "دفعة مستلمة");
    assert.equal(statement.finalBalance, 30);
});

test("cancelled invoice has zero active effect when shown", () => {
    const statement = build([invoice(2, 40, "cancelled")], [], [], {
        showVoided: true,
    });
    assert.equal(statement.entries[0]?.effect, 0);
    assert.equal(statement.finalBalance, 0);
});

test("voided transaction is excluded by default", () => {
    const voided = transaction(2, "debt", 50, {
        status: "voided",
        voidedAt: "2026-01-03T10:00:00.000Z",
    });
    assert.equal(build([], [voided]).entries.length, 0);
});

test("showing voided transactions does not change balance", () => {
    const voided = transaction(2, "debt", 50, {
        status: "voided",
        voidReason: "تصحيح",
    });
    const statement = build([], [voided], [], { showVoided: true });
    assert.equal(statement.entries.length, 1);
    assert.equal(statement.finalBalance, 0);
});

test("corrected replacement affects balance exactly once", () => {
    const original = transaction(2, "debt", 50, {
        status: "voided",
        voidReason: "تصحيح القيمة",
    });
    const replacement = transaction(3, "debt", 30, {
        correctedTransactionId: original.id,
        createdByCorrection: true,
    });
    const statement = build([], [original, replacement], [], {
        showVoided: true,
    });
    assert.equal(statement.finalBalance, 30);
    assert.equal(statement.entries[1]?.statusLabel, "حركة مصححة");
});

test("opening balance includes active effects before start date", () => {
    const statement = build(
        [],
        [
            transaction(2, "debt", 100),
            transaction(4, "payment_received", 25),
        ],
        [],
        { startDate: new Date("2026-01-03T00:00:00.000Z") },
    );
    assert.equal(statement.openingBalance, 100);
    assert.equal(statement.finalBalance, 75);
});

test("running balance is calculated oldest to newest", () => {
    const statement = build(
        [],
        [
            transaction(3, "payment_received", 20),
            transaction(2, "debt", 100),
        ],
    );
    assert.deepEqual(
        statement.entries.map((entry) => entry.runningBalance),
        [100, 80],
    );
});

test("positive final balance label is directional", () => {
    assert.equal(
        getStatementBalanceLabel(200_000, "IQD"),
        "صافي الحساب: لنا على العميل 200,000 د.ع",
    );
});

test("negative final balance label is directional", () => {
    assert.equal(
        getStatementBalanceLabel(-50, "USD"),
        "صافي الحساب: للعميل علينا USD 50.00",
    );
});

test("zero final balance label is unambiguous", () => {
    assert.equal(
        getStatementBalanceLabel(0, "IQD"),
        "صافي الحساب: مسدد بالكامل",
    );
});

test("deleted product does not remove invoice snapshot details", () => {
    const sale = invoice(2);
    const detail = item(2, 1);
    assert.equal(
        build([sale], [], [detail]).entries[0]?.invoiceItems[0]
            ?.productCodeSnapshot,
        "P-1",
    );
});

test("missing linked invoice remains a safe financial entry", () => {
    const linked = transaction(2, "debt", 40, {
        sourceType: "sale_invoice",
        sourceId: 999,
        sourceReference: "INV-OLD-004",
    });
    const entry = build([], [linked]).entries[0];
    assert.equal(entry?.invoiceDetailsMissing, true);
    assert.equal(entry?.sourceReference, "INV-OLD-004");
    assert.equal(entry?.effect, 40);
});

test("statement labels and money use Western digits", () => {
    const output = getStatementBalanceLabel(123_456, "IQD");
    assert.equal(/[٠-٩۰-۹]/.test(output), false);
    assert.match(output, /123,456/);
});
