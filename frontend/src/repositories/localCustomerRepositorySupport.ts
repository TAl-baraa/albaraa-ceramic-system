import type { CustomerBalance, CustomerBalanceRecord, CustomerTransaction } from "../types/customer";
import { calculateCustomerNetBalance, recalculateAllTransactionBalances } from "../utils/customerBalance.ts";
import {
    readStoredCustomerTransactions,
    writeStoredCustomerTransactions,
} from "../utils/customerStorage.ts";

export type CustomerStorage = Pick<Storage, "getItem" | "setItem">;

export function makeLocalId(ids: readonly number[]): number {
    return Math.max(Date.now(), ...ids.map((id) => id + 1), 1);
}

export function readRecalculatedTransactions(storage: CustomerStorage): CustomerTransaction[] {
    return recalculateAllTransactionBalances(readStoredCustomerTransactions(storage)).toSorted(
        (first, second) =>
            Date.parse(second.createdAt) - Date.parse(first.createdAt) || second.id - first.id,
    );
}

export function writeRecalculatedTransactions(
    transactions: readonly CustomerTransaction[],
    storage: CustomerStorage,
): CustomerTransaction[] {
    const recalculated = recalculateAllTransactionBalances(transactions).toSorted(
        (first, second) =>
            Date.parse(second.createdAt) - Date.parse(first.createdAt) || second.id - first.id,
    );
    writeStoredCustomerTransactions(recalculated, storage);
    return recalculated;
}

function balanceStatus(value: number): "owes_store" | "store_owes" | "settled" {
    return value > 0 ? "owes_store" : value < 0 ? "store_owes" : "settled";
}

export function localBalanceRecord(
    customerId: number,
    transactions: readonly CustomerTransaction[],
): CustomerBalanceRecord {
    const balances: CustomerBalance = calculateCustomerNetBalance(transactions, customerId);
    return {
        customerId,
        balances,
        statuses: {
            IQD: balanceStatus(balances.IQD),
            USD: balanceStatus(balances.USD),
        },
    };
}
