import assert from "node:assert/strict";
import test from "node:test";

import {
    formatCurrency,
    formatDate,
    formatDateTime,
    formatNumber,
    formatQuantity,
    normalizeWesternDigits,
} from "../src/utils/formatters.ts";

const NON_WESTERN_DIGITS = /[٠-٩۰-۹]/;

test("normalizes Arabic-Indic and Persian digits", () => {
    assert.equal(normalizeWesternDigits("٠١٢٣٤٥٦٧٨٩"), "0123456789");
    assert.equal(normalizeWesternDigits("۰۱۲۳۴۵۶۷۸۹"), "0123456789");
    assert.equal(
        normalizeWesternDigits("INV-٢٠٢٦-۰۰۴"),
        "INV-2026-004",
    );
});

test("formats IQD and USD with Western digits", () => {
    assert.equal(formatCurrency(250_000, "IQD"), "250,000 د.ع");
    assert.equal(formatCurrency(1450, "USD"), "USD 1,450.00");
});

test("formats quantities and numbers with Western digits", () => {
    assert.equal(formatQuantity(12.5), "12.5");
    assert.equal(formatNumber(1234), "1,234");
});

test("Arabic date text always uses Western digits", () => {
    const value = new Date(2026, 6, 29, 14, 5);
    const formatted = formatDate(value, {
        day: "numeric",
        month: "long",
        year: "numeric",
    });
    assert.equal(NON_WESTERN_DIGITS.test(formatted), false);
    assert.equal(NON_WESTERN_DIGITS.test(formatDateTime(value)), false);
});

test("invoice references remain Western and all outputs reject Arabic digits", () => {
    const invoiceNumber = normalizeWesternDigits("INV-2026-004");
    assert.equal(invoiceNumber, "INV-2026-004");
    [
        invoiceNumber,
        formatCurrency(123, "IQD"),
        formatCurrency(123, "USD"),
        formatQuantity(123.45),
        formatDate(new Date(2026, 0, 2)),
    ].forEach((output) =>
        assert.equal(NON_WESTERN_DIGITS.test(output), false),
    );
});
