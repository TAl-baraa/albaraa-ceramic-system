import assert from "node:assert/strict";
import test from "node:test";

import type { SaleInvoiceItem } from "../src/types/sale.ts";
import {
    formatSaleMoney,
    getPrintableCustomer,
    getPrintableInvoiceStatusLabel,
    getPrintableItemRows,
    getRemainingPresentation,
} from "../src/utils/salePresentation.ts";

test("presents positive, zero, and negative remaining amounts", () => {
    assert.equal(
        getRemainingPresentation(100, "IQD").label,
        "المتبقي",
    );
    assert.equal(
        getRemainingPresentation(0, "IQD").label,
        "مسدد بالكامل",
    );
    assert.equal(
        getRemainingPresentation(-25, "USD").label,
        "المبلغ الزائد للعميل",
    );
});

test("invoice item snapshots do not require a live product", () => {
    const item: SaleInvoiceItem = {
        id: 1,
        invoiceId: 2,
        productId: 999,
        productCodeSnapshot: "OLD-001",
        productNameSnapshot: "منتج تاريخي",
        unit: "قطعة",
        quantity: 2,
        unitPrice: 10,
        total: 20,
    };

    assert.deepEqual(getPrintableItemRows([item]), [
        {
            sequence: 1,
            code: "OLD-001",
            name: "منتج تاريخي",
            unit: "قطعة",
            quantity: 2,
            unitPrice: 10,
            total: 20,
        },
    ]);
});

test("deleted customer keeps snapshot name and omits live details", () => {
    assert.deepEqual(
        getPrintableCustomer(
            {
                customerId: 55,
                customerNameSnapshot: "عميل تاريخي",
            },
            [],
        ),
        {
            name: "عميل تاريخي",
            phone: null,
            address: null,
        },
    );
});

test("cash sale uses its safe printable customer label", () => {
    assert.deepEqual(
        getPrintableCustomer(
            {
                customerId: null,
                customerNameSnapshot: "",
            },
            [],
        ),
        {
            name: "بيع نقدي",
            phone: null,
            address: null,
        },
    );
});

test("cancelled invoices receive the printable cancellation label", () => {
    assert.equal(
        getPrintableInvoiceStatusLabel("cancelled"),
        "فاتورة ملغاة",
    );
    assert.equal(getPrintableInvoiceStatusLabel("completed"), null);
});

test("formats IQD without decimals and USD with two decimals", () => {
    assert.equal(formatSaleMoney(1250.75, "IQD"), "1,251 د.ع");
    assert.equal(formatSaleMoney(1250, "USD"), "USD 1,250.00");
});
