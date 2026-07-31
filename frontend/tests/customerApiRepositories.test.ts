import assert from "node:assert/strict";
import test from "node:test";

import { ApiError, type ApiClient, type ApiRequestOptions } from "../src/api/apiClient.ts";
import type {
    CustomerBalanceDto,
    CustomerDto,
    CustomerTransactionDto,
} from "../src/api/customers/customerApiTypes.ts";
import { ApiCustomerRepository } from "../src/repositories/ApiCustomerRepository.ts";
import { ApiCustomerTransactionRepository } from "../src/repositories/ApiCustomerTransactionRepository.ts";

const customer: CustomerDto = {
    id: 1, name: "Customer", phone: "", address: "", notes: "",
    createdAt: "2026-07-31T10:00:00Z", updatedAt: "2026-07-31T10:00:00Z",
    lastPaymentAt: null, balances: null,
};
const balance: CustomerBalanceDto = {
    customerId: 1,
    IQD: { balance: "0.000000", status: "settled" },
    USD: { balance: "0.000000", status: "settled" },
};
const transaction: CustomerTransactionDto = {
    id: 2, customerId: 1, transactionType: "debt", amount: "25.000000", currency: "IQD",
    note: "", status: "active", correctedTransactionId: null, voidedAt: null, voidReason: "",
    createdByCorrection: false, sourceType: "manual", sourceId: null, sourceReference: "",
    createdAt: "2026-07-31T10:00:00Z", recordedAt: "2026-07-31T10:00:00Z",
    updatedAt: "2026-07-31T10:00:00Z", effectAmount: "25.000000", runningBalance: null,
};

type Call = { method: string; path: string; options?: ApiRequestOptions };

function recordingClient(): { client: ApiClient; calls: Call[] } {
    const calls: Call[] = [];
    return {
        calls,
        client: {
            async get<T>(path, options) {
                calls.push({ method: "GET", path, options });
                if (path.endsWith("/balances")) return balance as T;
                if (path.endsWith("/transactions")) {
                    return { items: [transaction], total: 1, page: 1, pageSize: 20, totalPages: 1 } as T;
                }
                if (path === "/customers") {
                    return { items: [customer], total: 1, page: 1, pageSize: 20, totalPages: 1 } as T;
                }
                return customer as T;
            },
            async post<T>(path, options) {
                calls.push({ method: "POST", path, options });
                if (path.endsWith("/correct")) {
                    return { original: { ...transaction, status: "voided" }, replacement: { ...transaction, id: 3, correctedTransactionId: 2 }, balances: balance } as T;
                }
                if (path === "/customers") return customer as T;
                return transaction as T;
            },
            async patch<T>(path, options) {
                calls.push({ method: "PATCH", path, options });
                return customer as T;
            },
            async delete(path, options) { calls.push({ method: "DELETE", path, options }); },
        },
    };
}

test("customer repository sends create, update, delete, search, pagination, and balance requests", async () => {
    const mock = recordingClient();
    const repository = new ApiCustomerRepository(mock.client);
    await repository.create({ name: " Customer ", phone: "", address: "", notes: "" });
    await repository.update(1, { phone: " 0770 " });
    await repository.remove(1);
    await repository.list({ search: " Ali ", page: 2, pageSize: 10, includeBalances: true });
    await repository.getBalances(1);
    assert.deepEqual(mock.calls[0].options?.body, { name: "Customer", phone: "", address: "", notes: "" });
    assert.deepEqual(mock.calls[1].options?.body, { phone: "0770" });
    assert.equal(mock.calls[2].method, "DELETE");
    assert.deepEqual(mock.calls[3].options?.query, { search: "Ali", page: 2, pageSize: 10, includeBalances: true });
    assert.equal(mock.calls[4].path, "/customers/1/balances");
});

test("customer pagination combines pages and rejects a repeated page", async () => {
    let call = 0;
    const client: ApiClient = {
        async get<T>() {
            call += 1;
            return {
                items: [customer], total: 2, page: call === 1 ? 1 : 2,
                pageSize: 100, totalPages: 2,
            } as T;
        },
        async post<T>() { return customer as T; },
        async patch<T>() { return customer as T; },
        async delete() {},
    };
    assert.equal((await new ApiCustomerRepository(client).listAll()).length, 2);
    call = 0;
    const repeated: ApiClient = {
        ...client,
        async get<T>() { return { items: [customer], total: 2, page: 1, pageSize: 100, totalPages: 2 } as T; },
    };
    await assert.rejects(
        new ApiCustomerRepository(repeated).listAll(),
        (error: unknown) => error instanceof ApiError && error.code === "invalid_customer_pagination",
    );
});

test("transaction repository sends create, correction, void, list, and cancellation signals", async () => {
    const mock = recordingClient();
    const repository = new ApiCustomerTransactionRepository(mock.client);
    const controller = new AbortController();
    await repository.list(1, { currency: "IQD", includeVoided: true, includeRunningBalance: true, signal: controller.signal });
    await repository.create(1, { type: "debt", amount: 25, currency: "IQD", note: " Test " });
    await repository.correct(1, 2, { type: "credit", amount: 10, note: " Fix ", reason: " Wrong " });
    await repository.void(1, 3, " Duplicate ");
    assert.equal(mock.calls[0].options?.signal, controller.signal);
    assert.deepEqual(mock.calls[1].options?.body, { transactionType: "debt", amount: "25", currency: "IQD", note: "Test" });
    assert.deepEqual(mock.calls[2].options?.body, { transactionType: "credit", amount: "10", note: "Fix", reason: "Wrong" });
    assert.deepEqual(mock.calls[3].options?.body, { reason: "Duplicate" });
});

test("typed backend conflicts remain available to repository callers", async () => {
    const conflict = new ApiError({
        status: 409, code: "source_linked_transaction_protected",
        message: "Protected", details: { sourceReference: "INV-1" }, kind: "conflict",
    });
    const client: ApiClient = {
        async get<T>() { return balance as T; },
        async post() { throw conflict; },
        async patch<T>() { return customer as T; },
        async delete() { throw new ApiError({ status: 409, code: "customer_has_transactions", message: "Blocked", kind: "conflict" }); },
    };
    await assert.rejects(
        new ApiCustomerTransactionRepository(client).void(1, 2, "Reason"),
        (error: unknown) => error === conflict,
    );
    await assert.rejects(
        new ApiCustomerRepository(client).remove(1),
        (error: unknown) => error instanceof ApiError && error.code === "customer_has_transactions",
    );
});
