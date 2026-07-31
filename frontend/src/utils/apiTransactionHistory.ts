import type { CustomerTransactionRecord } from "../types/customer";
import { recalculateAllTransactionBalances } from "./customerBalance.ts";

export function recalculateApiTransactionHistory(
    transactions: readonly CustomerTransactionRecord[],
): CustomerTransactionRecord[] {
    return recalculateAllTransactionBalances(transactions).toSorted(
        (first, second) =>
            Date.parse(second.createdAt) - Date.parse(first.createdAt) ||
            second.id - first.id,
    );
}
