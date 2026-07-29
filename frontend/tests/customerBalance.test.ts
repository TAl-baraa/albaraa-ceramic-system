import assert from "node:assert/strict";
import test from "node:test";

import type {
    Currency,
    CustomerTransaction,
    CustomerTransactionType,
} from "../src/types/customer.ts";
import {
    calculateCustomerNetBalance,
    filterTransactionsByCurrency,
    recalculateCustomerTransactionHistory,
} from "../src/utils/customerBalance.ts";
import { parseStoredCustomerTransaction } from "../src/utils/customerStorage.ts";

const CUSTOMER_ID = 1;

function transaction(
    id: number,
    type: CustomerTransactionType,
    amount: number,
    currency: Currency = "IQD",
): CustomerTransaction {
    return {
        id,
        customerId: CUSTOMER_ID,
        type,
        amount,
        currency,
        note: "",
        createdAt: new Date(Date.UTC(2026, 0, id)).toISOString(),
        balanceAfter: { IQD: 999_999, USD: 999_999 },
    };
}

test("calculates cumulative customer net balances", () => {
    const debt = transaction(1, "debt", 25_000);
    const firstPayment = transaction(2, "payment_received", 10_000);
    const secondPayment = transaction(3, "payment_received", 5_000);

    assert.deepEqual(calculateCustomerNetBalance([debt], CUSTOMER_ID), {
        IQD: 25_000,
        USD: 0,
    });
    assert.equal(
        calculateCustomerNetBalance(
            [firstPayment, debt],
            CUSTOMER_ID,
        ).IQD,
        15_000,
    );
    assert.equal(
        calculateCustomerNetBalance(
            [secondPayment, debt, firstPayment],
            CUSTOMER_ID,
        ).IQD,
        10_000,
    );
});

test("recalculates balanceAfter oldest-first and ignores stale values", () => {
    const history = recalculateCustomerTransactionHistory(
        [
            transaction(3, "payment_received", 5_000),
            transaction(1, "debt", 25_000),
            transaction(2, "payment_received", 10_000),
        ],
        CUSTOMER_ID,
    );

    assert.deepEqual(
        history.map(({ balanceAfter }) => balanceAfter.IQD),
        [25_000, 15_000, 10_000],
    );
    assert.equal(
        calculateCustomerNetBalance(history, CUSTOMER_ID).IQD,
        10_000,
    );
});

test("applies credits, paid payments, and adjustments", () => {
    const credit = transaction(1, "credit", 8_000);
    const paymentPaid = transaction(2, "payment_paid", 3_000);

    assert.equal(
        calculateCustomerNetBalance([credit], CUSTOMER_ID).IQD,
        -8_000,
    );
    assert.equal(
        calculateCustomerNetBalance(
            [paymentPaid, credit],
            CUSTOMER_ID,
        ).IQD,
        -5_000,
    );
    assert.equal(
        calculateCustomerNetBalance(
            [transaction(1, "debt", 4_000), transaction(2, "adjustment", 12_000)],
            CUSTOMER_ID,
        ).IQD,
        12_000,
    );
});

test("keeps IQD and USD independent", () => {
    assert.deepEqual(
        calculateCustomerNetBalance(
            [
                transaction(1, "debt", 25_000),
                transaction(2, "debt", 100, "USD"),
                transaction(3, "payment_received", 5_000),
                transaction(4, "payment_received", 25, "USD"),
            ],
            CUSTOMER_ID,
        ),
        { IQD: 20_000, USD: 75 },
    );
});

test("credit 100 USD makes the store owe the customer", () => {
    assert.deepEqual(
        calculateCustomerNetBalance(
            [transaction(1, "credit", 100, "USD")],
            CUSTOMER_ID,
        ),
        { IQD: 0, USD: -100 },
    );
});

test("IQD and USD views read independent balances", () => {
    const balance = calculateCustomerNetBalance(
        [
            transaction(1, "debt", 25_000, "IQD"),
            transaction(2, "credit", 100, "USD"),
        ],
        CUSTOMER_ID,
    );

    assert.equal(balance.IQD, 25_000);
    assert.equal(balance.USD, -100);
});

test("currency filtering is non-mutating and returns only that currency", () => {
    const transactions = [
        transaction(1, "debt", 25_000, "IQD"),
        transaction(2, "credit", 100, "USD"),
        transaction(3, "payment_received", 5_000, "IQD"),
    ];
    const snapshot = structuredClone(transactions);
    const iqdView = filterTransactionsByCurrency(
        transactions,
        "IQD",
    );
    const usdView = filterTransactionsByCurrency(
        transactions,
        "USD",
    );

    assert.deepEqual(
        iqdView.map(({ currency }) => currency),
        ["IQD", "IQD"],
    );
    assert.deepEqual(
        usdView.map(({ currency }) => currency),
        ["USD"],
    );
    assert.deepEqual(transactions, snapshot);
});

test("uses context storage migration and runtime-shaped objects", () => {
    const storedTransactions = [
        {
            id: 1,
            customerId: CUSTOMER_ID,
            type: "debt",
            amount: "25000",
            currency: "IQD",
            note: "",
            createdAt: "2026-07-01T09:00:00.000Z",
            balanceAfter: { IQD: 25_000, USD: 0 },
        },
        {
            id: 2,
            customerId: CUSTOMER_ID,
            type: "payment_received",
            amount: 10_000,
            currency: "IQD",
            note: "",
            createdAt: "2026-07-02T09:00:00.000Z",
            balanceAfter: { IQD: 10_000, USD: 0 },
        },
        {
            id: 3,
            customerId: CUSTOMER_ID,
            type: "payment_received",
            amount: "5000",
            currency: "IQD",
            note: "",
            createdAt: "2026-07-03T09:00:00.000Z",
            balanceAfter: { IQD: 5_000, USD: 0 },
        },
    ];
    const transactions = storedTransactions.map((storedTransaction) => {
        const parsed = parseStoredCustomerTransaction(storedTransaction);

        assert.notEqual(parsed, null);
        return parsed;
    });

    assert.deepEqual(
        calculateCustomerNetBalance(
            transactions as CustomerTransaction[],
            CUSTOMER_ID,
        ),
        { IQD: 10_000, USD: 0 },
    );
});
