import type {
    Currency,
    CustomerBalance,
    CustomerTransaction,
} from "../types/customer";

const EMPTY_CUSTOMER_BALANCE: CustomerBalance = {
    IQD: 0,
    USD: 0,
};

function normalizeAmount(amount: number) {
    return Number(amount.toFixed(6));
}

function applyTransaction(
    balance: CustomerBalance,
    transaction: CustomerTransaction,
): CustomerBalance {
    const currentAmount = balance[transaction.currency];
    let nextAmount: number;

    switch (transaction.type) {
        case "debt":
        case "payment_paid":
            nextAmount = currentAmount + transaction.amount;
            break;
        case "credit":
        case "payment_received":
            nextAmount = currentAmount - transaction.amount;
            break;
        case "adjustment":
            nextAmount = transaction.amount;
            break;
    }

    return {
        ...balance,
        [transaction.currency]: normalizeAmount(nextAmount),
    };
}

function isActive(transaction: CustomerTransaction) {
    return transaction.status === "active";
}

function sortOldestFirst(
    transactions: readonly CustomerTransaction[],
): CustomerTransaction[] {
    return transactions.toSorted(
        (first, second) =>
            Date.parse(first.createdAt) -
                Date.parse(second.createdAt) ||
            first.id - second.id,
    );
}

export function recalculateCustomerTransactionHistory(
    transactions: readonly CustomerTransaction[],
    customerId: number,
): CustomerTransaction[] {
    let balance = { ...EMPTY_CUSTOMER_BALANCE };

    return sortOldestFirst(
        transactions.filter(
            (transaction) => transaction.customerId === customerId,
        ),
    ).map((transaction) => {
        if (isActive(transaction)) {
            balance = applyTransaction(balance, transaction);
        }

        return {
            ...transaction,
            balanceAfter: { ...balance },
        };
    });
}

export function recalculateAllTransactionBalances(
    transactions: readonly CustomerTransaction[],
): CustomerTransaction[] {
    const balancesByCustomer = new Map<number, CustomerBalance>();

    return sortOldestFirst(transactions).map((transaction) => {
        const previousBalance =
            balancesByCustomer.get(transaction.customerId) ??
            EMPTY_CUSTOMER_BALANCE;
        const balanceAfter = isActive(transaction)
            ? applyTransaction(previousBalance, transaction)
            : previousBalance;

        balancesByCustomer.set(transaction.customerId, balanceAfter);

        return {
            ...transaction,
            balanceAfter: { ...balanceAfter },
        };
    });
}

export function calculateCustomerNetBalance(
    transactions: readonly CustomerTransaction[],
    customerId: number,
): CustomerBalance {
    return sortOldestFirst(transactions).reduce<CustomerBalance>(
        (balance, transaction) =>
            transaction.customerId === customerId
                && isActive(transaction)
                ? applyTransaction(balance, transaction)
                : balance,
        { ...EMPTY_CUSTOMER_BALANCE },
    );
}

export function getLatestActivePaymentDate(
    transactions: readonly CustomerTransaction[],
    customerId: number,
): string | null {
    return transactions.reduce<string | null>(
        (latestDate, transaction) => {
            if (
                transaction.customerId !== customerId ||
                !isActive(transaction) ||
                (transaction.type !== "payment_received" &&
                    transaction.type !== "payment_paid")
            ) {
                return latestDate;
            }

            if (
                latestDate === null ||
                Date.parse(transaction.createdAt) >
                    Date.parse(latestDate)
            ) {
                return transaction.createdAt;
            }

            return latestDate;
        },
        null,
    );
}

export function filterTransactionsByCurrency(
    transactions: readonly CustomerTransaction[],
    currency: Currency,
): CustomerTransaction[] {
    return transactions.filter(
        (transaction) => transaction.currency === currency,
    );
}
