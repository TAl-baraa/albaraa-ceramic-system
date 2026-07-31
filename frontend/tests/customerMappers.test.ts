import assert from "node:assert/strict";
import test from "node:test";

import type {
    CustomerDto,
    CustomerTransactionDto,
} from "../src/api/customers/customerApiTypes.ts";
import {
    CustomerMappingError,
    customerBalanceDtoToDomain,
    customerCreateToDto,
    customerDtoToDomain,
    customerTransactionDtoToDomain,
    customerUpdateToDto,
    transactionCorrectionToDto,
    transactionCreateToDto,
    transactionVoidToDto,
} from "../src/api/customers/customerMappers.ts";

const customerDto: CustomerDto = {
    id: 4,
    name: " Example Customer ",
    phone: " 0770 ",
    address: " Baghdad ",
    notes: " Note ",
    createdAt: "2026-07-31T10:00:00Z",
    updatedAt: "2026-07-31T11:00:00Z",
    lastPaymentAt: null,
    balances: null,
};

function transactionDto(
    transactionType: CustomerTransactionDto["transactionType"] = "debt",
): CustomerTransactionDto {
    return {
        id: 8,
        customerId: 4,
        transactionType,
        amount: "25000.000000",
        currency: "IQD",
        note: " Manual entry ",
        status: "active",
        correctedTransactionId: null,
        voidedAt: null,
        voidReason: "",
        createdByCorrection: false,
        sourceType: "manual",
        sourceId: null,
        sourceReference: "",
        createdAt: "2026-07-31T10:00:00Z",
        recordedAt: "2026-07-31T10:00:01Z",
        updatedAt: "2026-07-31T10:00:01Z",
        effectAmount: "25000.000000",
        runningBalance: null,
    };
}

test("customer DTO maps optional text and keeps API metadata separately", () => {
    assert.deepEqual(customerDtoToDomain(customerDto), {
        id: 4,
        name: "Example Customer",
        phone: "0770",
        address: "Baghdad",
        notes: "Note",
        createdAt: customerDto.createdAt,
        lastPaymentAt: null,
        apiMetadata: { updatedAt: customerDto.updatedAt },
    });
    assert.throws(() => customerDtoToDomain({ ...customerDto, id: 0 }), CustomerMappingError);
    assert.throws(() => customerDtoToDomain({ ...customerDto, name: " " }), CustomerMappingError);
});

test("customer create excludes audit fields and partial update sends only supplied fields", () => {
    assert.deepEqual(
        customerCreateToDto({ name: " Ali ", phone: " 123 ", address: " A ", notes: " N " }),
        { name: "Ali", phone: "123", address: "A", notes: "N" },
    );
    assert.deepEqual(customerUpdateToDto({ phone: " 456 ", notes: " " }), {
        phone: "456",
        notes: "",
    });
});

test("balance mapping preserves independent signs and settled status", () => {
    const mapped = customerBalanceDtoToDomain({
        customerId: 4,
        IQD: { balance: "10000.000000", status: "owes_store" },
        USD: { balance: "-100.000000", status: "store_owes" },
    });
    assert.deepEqual(mapped.balances, { IQD: 10000, USD: -100 });
    assert.deepEqual(mapped.statuses, { IQD: "owes_store", USD: "store_owes" });
    assert.equal(
        customerBalanceDtoToDomain({
            customerId: 4,
            IQD: { balance: "0.000000", status: "settled" },
            USD: { balance: "0.000000", status: "settled" },
        }).balances.IQD,
        0,
    );
    assert.throws(
        () => customerBalanceDtoToDomain({
            customerId: 4,
            IQD: { balance: "10,000", status: "owes_store" },
            USD: { balance: "0", status: "settled" },
        }),
        CustomerMappingError,
    );
});

test("all supported transaction types map with exact decimal and audit fields", () => {
    for (const type of ["debt", "credit", "payment_received", "payment_paid"] as const) {
        const mapped = customerTransactionDtoToDomain(transactionDto(type));
        assert.equal(mapped.type, type);
        assert.equal(mapped.amount, 25000);
    }
    const audited = customerTransactionDtoToDomain({
        ...transactionDto("credit"),
        status: "voided",
        correctedTransactionId: 7,
        voidedAt: "2026-07-31T12:00:00Z",
        voidReason: " Corrected ",
        createdByCorrection: true,
        sourceType: "sale_invoice",
        sourceId: 12,
        sourceReference: " INV-2026-0012 ",
        runningBalance: "-100.000000",
    });
    assert.equal(audited.status, "voided");
    assert.equal(audited.correctedTransactionId, 7);
    assert.equal(audited.sourceType, "sale_invoice");
    assert.equal(audited.sourceId, 12);
    assert.equal(audited.sourceReference, "INV-2026-0012");
    assert.equal(audited.apiMetadata?.runningBalance, -100);
    assert.throws(
        () => customerTransactionDtoToDomain({ ...transactionDto(), amount: "NaN" }),
        CustomerMappingError,
    );
});

test("manual transaction request mappers expose no source or audit controls", () => {
    assert.deepEqual(
        transactionCreateToDto({ type: "debt", amount: 25, currency: "IQD", note: " Debt " }),
        { transactionType: "debt", amount: "25", currency: "IQD", note: "Debt" },
    );
    assert.deepEqual(
        transactionCorrectionToDto({ type: "credit", amount: 10, note: " Fix ", reason: " Wrong " }),
        { transactionType: "credit", amount: "10", note: "Fix", reason: "Wrong" },
    );
    assert.deepEqual(transactionVoidToDto(" Duplicate "), { reason: "Duplicate" });
    assert.throws(() => transactionVoidToDto(" "), /required/);
});
