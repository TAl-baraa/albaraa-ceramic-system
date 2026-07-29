import {
    createContext,
    useContext,
    useEffect,
    useState,
} from "react";
import type { ReactNode } from "react";

import type {
    Currency,
    Customer,
    CustomerActionResult,
    CustomerBalance,
    CustomerInput,
    CustomerTransaction,
    CustomerTransactionCorrectionInput,
    CustomerTransactionInput,
    EditableCustomerTransactionType,
} from "../types/customer";
import {
    calculateCustomerNetBalance,
    getLatestActivePaymentDate,
    recalculateAllTransactionBalances,
} from "../utils/customerBalance";
import { parseStoredCustomerTransaction } from "../utils/customerStorage";

type CustomersContextValue = {
    customers: Customer[];
    transactions: CustomerTransaction[];
    addCustomer: (customer: CustomerInput) => CustomerActionResult;
    updateCustomer: (
        customerId: number,
        customer: CustomerInput,
    ) => CustomerActionResult;
    deleteCustomer: (customerId: number) => CustomerActionResult;
    addTransaction: (
        transaction: CustomerTransactionInput,
    ) => CustomerActionResult;
    correctTransaction: (
        correction: CustomerTransactionCorrectionInput,
    ) => CustomerActionResult;
    voidTransaction: (
        transactionId: number,
        reason: string,
    ) => CustomerActionResult;
    getCustomerBalance: (customerId: number) => CustomerBalance;
};

type CustomersProviderProps = {
    children: ReactNode;
};

const CUSTOMERS_STORAGE_KEY = "albaraa-ceramic-customers";
const TRANSACTIONS_STORAGE_KEY =
    "albaraa-ceramic-customer-transactions";
const CustomersContext =
    createContext<CustomersContextValue | null>(null);

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function isFiniteNonNegativeNumber(value: unknown): value is number {
    return (
        typeof value === "number" &&
        Number.isFinite(value) &&
        value >= 0
    );
}

function isCurrency(value: unknown): value is Currency {
    return value === "IQD" || value === "USD";
}

function isEditableTransactionType(
    value: unknown,
): value is EditableCustomerTransactionType {
    return (
        value === "debt" ||
        value === "credit" ||
        value === "payment_received" ||
        value === "payment_paid"
    );
}

function isValidDate(value: unknown): value is string {
    return (
        typeof value === "string" &&
        Number.isFinite(Date.parse(value))
    );
}

function parseCustomer(value: unknown): Customer | null {
    if (!isRecord(value)) {
        return null;
    }

    if (
        !isFiniteNonNegativeNumber(value.id) ||
        typeof value.name !== "string" ||
        typeof value.phone !== "string" ||
        typeof value.address !== "string" ||
        !isValidDate(value.createdAt) ||
        !(
            value.lastPaymentAt === null ||
            isValidDate(value.lastPaymentAt)
        ) ||
        typeof value.notes !== "string"
    ) {
        return null;
    }

    return {
        id: value.id,
        name: value.name,
        phone: value.phone,
        address: value.address,
        createdAt: value.createdAt,
        lastPaymentAt: value.lastPaymentAt,
        notes: value.notes,
    };
}

function loadArray<T>(
    storageKey: string,
    parser: (value: unknown) => T | null,
): T[] {
    try {
        const storedValue = localStorage.getItem(storageKey);

        if (!storedValue) {
            return [];
        }

        const parsedValue: unknown = JSON.parse(storedValue);

        if (!Array.isArray(parsedValue)) {
            return [];
        }

        return parsedValue
            .map(parser)
            .filter((item): item is T => item !== null);
    } catch {
        return [];
    }
}

function normalizeAmount(amount: number) {
    return Number(amount.toFixed(6));
}

function makeId(existingIds: number[]) {
    return Math.max(Date.now(), ...existingIds.map((id) => id + 1), 1);
}

export function CustomersProvider({
    children,
}: CustomersProviderProps) {
    const [customers, setCustomers] = useState<Customer[]>(() =>
        loadArray(CUSTOMERS_STORAGE_KEY, parseCustomer),
    );
    const [transactions, setTransactions] =
        useState<CustomerTransaction[]>(() =>
            recalculateAllTransactionBalances(
                loadArray(
                    TRANSACTIONS_STORAGE_KEY,
                    parseStoredCustomerTransaction,
                ),
            ).toSorted(
                (first, second) =>
                    Date.parse(second.createdAt) -
                        Date.parse(first.createdAt) ||
                    second.id - first.id,
            ),
        );

    useEffect(() => {
        try {
            localStorage.setItem(
                CUSTOMERS_STORAGE_KEY,
                JSON.stringify(customers),
            );
        } catch {
            // Keep the in-memory customer list usable when storage fails.
        }
    }, [customers]);

    useEffect(() => {
        try {
            localStorage.setItem(
                TRANSACTIONS_STORAGE_KEY,
                JSON.stringify(transactions),
            );
        } catch {
            // Keep the in-memory transaction history usable when storage fails.
        }
    }, [transactions]);

    useEffect(() => {
        setCustomers((currentCustomers) =>
            currentCustomers.map((customer) => {
                const lastPaymentAt = getLatestActivePaymentDate(
                    transactions,
                    customer.id,
                );

                return customer.lastPaymentAt === lastPaymentAt
                    ? customer
                    : { ...customer, lastPaymentAt };
            }),
        );
    }, [transactions]);

    function phoneExists(phone: string, excludedCustomerId?: number) {
        const normalizedPhone = phone.trim();

        return (
            normalizedPhone !== "" &&
            customers.some(
                (customer) =>
                    customer.id !== excludedCustomerId &&
                    customer.phone.trim() === normalizedPhone,
            )
        );
    }

    function addCustomer(input: CustomerInput): CustomerActionResult {
        const name = input.name.trim();
        const phone = input.phone.trim();

        if (!name) {
            return { success: false, error: "اسم العميل مطلوب." };
        }

        if (phoneExists(phone)) {
            return {
                success: false,
                error: "رقم الهاتف مستخدم لعميل آخر.",
            };
        }

        const customer: Customer = {
            id: makeId(customers.map(({ id }) => id)),
            name,
            phone,
            address: input.address.trim(),
            notes: input.notes.trim(),
            createdAt: new Date().toISOString(),
            lastPaymentAt: null,
        };

        setCustomers((currentCustomers) => [
            customer,
            ...currentCustomers,
        ]);
        return { success: true };
    }

    function updateCustomer(
        customerId: number,
        input: CustomerInput,
    ): CustomerActionResult {
        const customer = customers.find(
            (currentCustomer) => currentCustomer.id === customerId,
        );
        const name = input.name.trim();
        const phone = input.phone.trim();

        if (!customer) {
            return { success: false, error: "العميل غير موجود." };
        }

        if (!name) {
            return { success: false, error: "اسم العميل مطلوب." };
        }

        if (phoneExists(phone, customerId)) {
            return {
                success: false,
                error: "رقم الهاتف مستخدم لعميل آخر.",
            };
        }

        setCustomers((currentCustomers) =>
            currentCustomers.map((currentCustomer) =>
                currentCustomer.id === customerId
                    ? {
                          ...currentCustomer,
                          name,
                          phone,
                          address: input.address.trim(),
                          notes: input.notes.trim(),
                      }
                    : currentCustomer,
            ),
        );
        return { success: true };
    }

    function deleteCustomer(customerId: number): CustomerActionResult {
        if (
            transactions.some(
                (transaction) => transaction.customerId === customerId,
            )
        ) {
            return {
                success: false,
                error: "لا يمكن حذف عميل لديه حركات مالية مسجلة.",
            };
        }

        if (!customers.some((customer) => customer.id === customerId)) {
            return { success: false, error: "العميل غير موجود." };
        }

        setCustomers((currentCustomers) =>
            currentCustomers.filter(
                (customer) => customer.id !== customerId,
            ),
        );
        return { success: true };
    }

    function addTransaction(
        input: CustomerTransactionInput,
    ): CustomerActionResult {
        if (
            !customers.some(
                (customer) => customer.id === input.customerId,
            )
        ) {
            return { success: false, error: "العميل غير موجود." };
        }

        if (!isEditableTransactionType(input.type)) {
            return { success: false, error: "نوع الحركة غير صالح." };
        }

        if (!isCurrency(input.currency)) {
            return { success: false, error: "العملة غير صالحة." };
        }

        if (!Number.isFinite(input.amount) || input.amount <= 0) {
            return {
                success: false,
                error: "يجب أن يكون المبلغ أكبر من صفر.",
            };
        }

        const createdAt = new Date().toISOString();
        const transaction: CustomerTransaction = {
            id: makeId(transactions.map(({ id }) => id)),
            customerId: input.customerId,
            type: input.type,
            amount: normalizeAmount(input.amount),
            currency: input.currency,
            note: input.note.trim(),
            createdAt,
            recordedAt: createdAt,
            balanceAfter: { IQD: 0, USD: 0 },
            status: "active",
            correctedTransactionId: null,
            voidedAt: null,
            voidReason: "",
            createdByCorrection: false,
        };

        setTransactions((currentTransactions) => {
            const recalculatedTransactions =
                recalculateAllTransactionBalances([
                    ...currentTransactions,
                    transaction,
                ]);

            return recalculatedTransactions.toSorted(
                (first, second) =>
                    Date.parse(second.createdAt) -
                        Date.parse(first.createdAt) ||
                    second.id - first.id,
            );
        });

        return { success: true };
    }

    function correctTransaction(
        input: CustomerTransactionCorrectionInput,
    ): CustomerActionResult {
        const original = transactions.find(
            (transaction) => transaction.id === input.transactionId,
        );
        const reason = input.reason.trim();

        if (!original) {
            return { success: false, error: "الحركة غير موجودة." };
        }

        if (original.status === "voided") {
            return {
                success: false,
                error: "لا يمكن تصحيح حركة ملغاة.",
            };
        }

        if (!isEditableTransactionType(input.type)) {
            return { success: false, error: "نوع الحركة مطلوب." };
        }

        if (!Number.isFinite(input.amount) || input.amount <= 0) {
            return {
                success: false,
                error: "يجب أن يكون المبلغ المصحح أكبر من صفر.",
            };
        }

        if (!reason) {
            return { success: false, error: "سبب التصحيح مطلوب." };
        }

        const correctedAt = new Date().toISOString();
        const replacement: CustomerTransaction = {
            ...original,
            id: makeId(transactions.map(({ id }) => id)),
            type: input.type,
            amount: normalizeAmount(input.amount),
            note: input.note.trim(),
            recordedAt: correctedAt,
            balanceAfter: { IQD: 0, USD: 0 },
            status: "active",
            correctedTransactionId: original.id,
            voidedAt: null,
            voidReason: "",
            createdByCorrection: true,
        };

        setTransactions((currentTransactions) =>
            recalculateAllTransactionBalances([
                ...currentTransactions.map((transaction) =>
                    transaction.id === original.id
                        ? {
                              ...transaction,
                              status: "voided" as const,
                              voidedAt: correctedAt,
                              voidReason: reason,
                          }
                        : transaction,
                ),
                replacement,
            ]).toSorted(
                (first, second) =>
                    Date.parse(second.createdAt) -
                        Date.parse(first.createdAt) ||
                    second.id - first.id,
            ),
        );

        return { success: true };
    }

    function voidTransaction(
        transactionId: number,
        cancellationReason: string,
    ): CustomerActionResult {
        const transaction = transactions.find(
            (currentTransaction) =>
                currentTransaction.id === transactionId,
        );
        const reason = cancellationReason.trim();

        if (!transaction) {
            return { success: false, error: "الحركة غير موجودة." };
        }

        if (transaction.status === "voided") {
            return {
                success: false,
                error: "الحركة ملغاة بالفعل.",
            };
        }

        if (!reason) {
            return { success: false, error: "سبب الإلغاء مطلوب." };
        }

        const voidedAt = new Date().toISOString();

        setTransactions((currentTransactions) =>
            recalculateAllTransactionBalances(
                currentTransactions.map((currentTransaction) =>
                    currentTransaction.id === transactionId
                        ? {
                              ...currentTransaction,
                              status: "voided" as const,
                              voidedAt,
                              voidReason: reason,
                          }
                        : currentTransaction,
                ),
            ).toSorted(
                (first, second) =>
                    Date.parse(second.createdAt) -
                        Date.parse(first.createdAt) ||
                    second.id - first.id,
            ),
        );

        return { success: true };
    }

    function getCustomerBalance(customerId: number): CustomerBalance {
        return calculateCustomerNetBalance(
            transactions,
            customerId,
        );
    }

    return (
        <CustomersContext.Provider
            value={{
                customers,
                transactions,
                addCustomer,
                updateCustomer,
                deleteCustomer,
                addTransaction,
                correctTransaction,
                voidTransaction,
                getCustomerBalance,
            }}
        >
            {children}
        </CustomersContext.Provider>
    );
}

// oxlint-disable-next-line react/only-export-components
export function useCustomers() {
    const context = useContext(CustomersContext);

    if (!context) {
        throw new Error(
            "useCustomers must be used inside CustomersProvider",
        );
    }

    return context;
}
