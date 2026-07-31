import assert from "node:assert/strict";
import test from "node:test";

import { ApiError } from "../src/api/apiClient.ts";
import { apiErrorToArabic } from "../src/api/apiErrorMessages.ts";
import { ApiCustomerRepository } from "../src/repositories/ApiCustomerRepository.ts";
import { ApiCustomerTransactionRepository } from "../src/repositories/ApiCustomerTransactionRepository.ts";
import { LocalStorageCustomerRepository } from "../src/repositories/LocalStorageCustomerRepository.ts";
import { LocalStorageCustomerTransactionRepository } from "../src/repositories/LocalStorageCustomerTransactionRepository.ts";
import { createCustomerRepository } from "../src/repositories/createCustomerRepository.ts";
import { createCustomerTransactionRepository } from "../src/repositories/createCustomerTransactionRepository.ts";
import type { CustomerTransactionRecord } from "../src/types/customer.ts";
import { recalculateApiTransactionHistory } from "../src/utils/apiTransactionHistory.ts";
import {
    CUSTOMERS_STORAGE_KEY,
    CUSTOMER_TRANSACTIONS_STORAGE_KEY,
} from "../src/utils/customerStorage.ts";

function memoryStorage(initial: Record<string, string> = {}) {
    const values = new Map(Object.entries(initial));
    return {
        values,
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => { values.set(key, value); },
    };
}

function tx(
    id: number,
    type: CustomerTransactionRecord["type"],
    amount: number,
    currency: CustomerTransactionRecord["currency"],
    status: CustomerTransactionRecord["status"] = "active",
): CustomerTransactionRecord {
    return {
        id, customerId: 1, type, amount, currency, note: "", status,
        createdAt: `2026-07-31T10:00:0${id}Z`, recordedAt: `2026-07-31T10:00:0${id}Z`,
        balanceAfter: { IQD: 999, USD: 999 }, correctedTransactionId: null,
        voidedAt: status === "voided" ? "2026-07-31T11:00:00Z" : null,
        voidReason: status === "voided" ? "void" : "", createdByCorrection: false,
        sourceType: "manual", sourceId: null, sourceReference: "",
    };
}

test("factories select local and API customer repositories", () => {
    const storage = memoryStorage();
    const localConfig = { apiBaseUrl: "https://example.test/api", dataSource: "localStorage" as const };
    const apiConfig = { ...localConfig, dataSource: "api" as const };
    assert.ok(createCustomerRepository(localConfig, storage) instanceof LocalStorageCustomerRepository);
    assert.ok(createCustomerRepository(apiConfig) instanceof ApiCustomerRepository);
    assert.ok(createCustomerTransactionRepository(localConfig, storage) instanceof LocalStorageCustomerTransactionRepository);
    assert.ok(createCustomerTransactionRepository(apiConfig) instanceof ApiCustomerTransactionRepository);
});

test("accounting replay ignores stale snapshots, voids, and currency mixing", () => {
    const history = recalculateApiTransactionHistory([
        tx(1, "debt", 25000, "IQD"),
        tx(2, "payment_received", 10000, "IQD"),
        tx(3, "payment_received", 5000, "IQD"),
        tx(4, "credit", 100, "USD"),
        tx(5, "debt", 999, "IQD", "voided"),
    ]);
    assert.deepEqual(history.map((item) => item.id), [5, 4, 3, 2, 1]);
    assert.deepEqual(history.find((item) => item.id === 3)?.balanceAfter, { IQD: 10000, USD: 0 });
    assert.deepEqual(history.find((item) => item.id === 4)?.balanceAfter, { IQD: 10000, USD: -100 });
    assert.deepEqual(history.find((item) => item.id === 5)?.balanceAfter, { IQD: 10000, USD: -100 });
});

test("corrected local replacement counts once and reuses existing transaction migration", async () => {
    const legacy = {
        ...tx(1, "debt", 25000, "IQD"),
        amount: "25000",
        recordedAt: undefined,
        balanceAfter: { IQD: 777, USD: 777 },
    };
    const storage = memoryStorage({
        [CUSTOMERS_STORAGE_KEY]: JSON.stringify([{
            id: 1, name: "Customer", phone: "", address: "",
            createdAt: "2026-07-31T09:00:00Z", lastPaymentAt: null, notes: "",
        }]),
        [CUSTOMER_TRANSACTIONS_STORAGE_KEY]: JSON.stringify([legacy]),
    });
    const repository = new LocalStorageCustomerTransactionRepository(storage);
    const result = await repository.correct(1, 1, {
        type: "debt", amount: 10000, note: "Corrected", reason: "Wrong amount",
    });
    assert.equal(result.original.status, "voided");
    assert.equal(result.replacement.correctedTransactionId, 1);
    assert.equal(result.replacement.createdByCorrection, true);
    assert.equal(result.balances.balances.IQD, 10000);
    assert.ok(storage.values.has(CUSTOMER_TRANSACTIONS_STORAGE_KEY));
    assert.ok(storage.values.has(CUSTOMERS_STORAGE_KEY));
});

test("local repository preserves keys and blocks deletion without resetting data", async () => {
    const storedCustomer = {
        id: 1, name: "Customer", phone: "", address: "",
        createdAt: "2026-07-31T09:00:00Z", lastPaymentAt: null, notes: "",
    };
    const storage = memoryStorage({
        [CUSTOMERS_STORAGE_KEY]: JSON.stringify([storedCustomer]),
        [CUSTOMER_TRANSACTIONS_STORAGE_KEY]: JSON.stringify([tx(1, "debt", 1, "IQD")]),
    });
    await assert.rejects(
        new LocalStorageCustomerRepository(storage).remove(1),
        (error: unknown) => error instanceof ApiError && error.code === "customer_has_transactions",
    );
    assert.equal(JSON.parse(storage.values.get(CUSTOMERS_STORAGE_KEY) ?? "[]").length, 1);
});

test("Arabic error mapping covers customer and transaction conflicts", () => {
    const message = (code: string, kind: "not_found" | "conflict" | "validation") =>
        apiErrorToArabic(new ApiError({ status: 409, code, message: "technical", kind }));
    assert.equal(message("customer_not_found", "not_found"), "العميل غير موجود.");
    assert.equal(message("transaction_not_found", "not_found"), "الحركة المالية غير موجودة.");
    assert.equal(message("customer_has_transactions", "conflict"), "لا يمكن حذف العميل لوجود حركات مالية مرتبطة به.");
    assert.equal(message("transaction_already_voided", "conflict"), "هذه الحركة ملغاة بالفعل.");
    assert.equal(message("source_linked_transaction_protected", "conflict"), "يجب تعديل الحركة المرتبطة بالفاتورة من خلال إجراءات الفاتورة.");
    assert.equal(message("correction_reason_required", "validation"), "يجب إدخال سبب التصحيح.");
    assert.equal(message("void_reason_required", "validation"), "يجب إدخال سبب الإلغاء.");
    assert.equal(message("invalid_amount", "validation"), "يجب أن يكون المبلغ أكبر من صفر.");
});
