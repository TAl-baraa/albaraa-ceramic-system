import { ApiError } from "../api/apiClient.ts";
import type {
    CustomerBalanceRecord,
    CustomerTransaction,
    CustomerTransactionCorrectionInput,
    CustomerTransactionInput,
    CustomerTransactionRecord,
} from "../types/customer";
import { readStoredCustomers } from "../utils/customerStorage.ts";
import type {
    CustomerTransactionCorrectionResult,
    CustomerTransactionListOptions,
    CustomerTransactionPage,
    CustomerTransactionRepository,
} from "./CustomerTransactionRepository";
import {
    localBalanceRecord,
    makeLocalId,
    readRecalculatedTransactions,
    writeRecalculatedTransactions,
    type CustomerStorage,
} from "./localCustomerRepositorySupport.ts";

function normalizeAmount(amount: number): number {
    return Number(amount.toFixed(6));
}

export class LocalStorageCustomerTransactionRepository
implements CustomerTransactionRepository {
    private readonly storage: CustomerStorage;

    constructor(storage: CustomerStorage = localStorage) {
        this.storage = storage;
    }

    async list(
        customerId: number,
        options: CustomerTransactionListOptions = {},
    ): Promise<CustomerTransactionPage> {
        let items = readRecalculatedTransactions(this.storage).filter(
            (transaction) =>
                transaction.customerId === customerId &&
                (!options.currency || transaction.currency === options.currency) &&
                (!options.status || transaction.status === options.status) &&
                (!options.transactionType || transaction.type === options.transactionType) &&
                (options.includeVoided !== false || transaction.status === "active") &&
                (!options.dateFrom || transaction.createdAt >= options.dateFrom) &&
                (!options.dateTo || transaction.createdAt <= options.dateTo),
        );
        const total = items.length;
        const page = options.page ?? 1;
        const pageSize = options.pageSize ?? 20;
        items = items.slice((page - 1) * pageSize, page * pageSize);
        return {
            items,
            total,
            page,
            pageSize,
            totalPages: total ? Math.ceil(total / pageSize) : 0,
        };
    }

    async create(
        customerId: number,
        input: Omit<CustomerTransactionInput, "customerId">,
    ): Promise<CustomerTransactionRecord> {
        this.requireCustomer(customerId);
        if (!Number.isFinite(input.amount) || input.amount <= 0) throw this.invalidAmount();
        const transactions = readRecalculatedTransactions(this.storage);
        const createdAt = new Date().toISOString();
        const transaction: CustomerTransaction = {
            id: makeLocalId(transactions.map(({ id }) => id)),
            customerId,
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
            sourceType: "manual",
            sourceId: null,
            sourceReference: "",
        };
        return writeRecalculatedTransactions([...transactions, transaction], this.storage)
            .find((item) => item.id === transaction.id)!;
    }

    async correct(
        customerId: number,
        transactionId: number,
        input: Omit<CustomerTransactionCorrectionInput, "transactionId">,
    ): Promise<CustomerTransactionCorrectionResult> {
        this.requireCustomer(customerId);
        const transactions = readRecalculatedTransactions(this.storage);
        const original = transactions.find((item) => item.id === transactionId);
        if (!original || original.customerId !== customerId) throw this.transactionNotFound();
        if (original.status === "voided") throw this.alreadyVoided();
        if (!Number.isFinite(input.amount) || input.amount <= 0) throw this.invalidAmount();
        const reason = input.reason.trim();
        if (!reason) throw new ApiError({ status: 422, code: "correction_reason_required", message: "Correction reason required", kind: "validation" });
        const correctedAt = new Date().toISOString();
        const replacement: CustomerTransaction = {
            ...original,
            id: makeLocalId(transactions.map(({ id }) => id)),
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
        const updated = writeRecalculatedTransactions(
            [
                ...transactions.map((item) =>
                    item.id === original.id
                        ? { ...item, status: "voided" as const, voidedAt: correctedAt, voidReason: reason }
                        : item,
                ),
                replacement,
            ],
            this.storage,
        );
        return {
            original: updated.find((item) => item.id === original.id)!,
            replacement: updated.find((item) => item.id === replacement.id)!,
            balances: localBalanceRecord(customerId, updated),
        };
    }

    async void(customerId: number, transactionId: number, reasonInput: string): Promise<CustomerTransactionRecord> {
        this.requireCustomer(customerId);
        const transactions = readRecalculatedTransactions(this.storage);
        const transaction = transactions.find((item) => item.id === transactionId);
        if (!transaction || transaction.customerId !== customerId) throw this.transactionNotFound();
        if (transaction.status === "voided") throw this.alreadyVoided();
        const reason = reasonInput.trim();
        if (!reason) throw new ApiError({ status: 422, code: "void_reason_required", message: "Void reason required", kind: "validation" });
        const voidedAt = new Date().toISOString();
        return writeRecalculatedTransactions(
            transactions.map((item) =>
                item.id === transactionId
                    ? { ...item, status: "voided" as const, voidedAt, voidReason: reason }
                    : item,
            ),
            this.storage,
        ).find((item) => item.id === transactionId)!;
    }

    async getBalances(customerId: number): Promise<CustomerBalanceRecord> {
        this.requireCustomer(customerId);
        return localBalanceRecord(customerId, readRecalculatedTransactions(this.storage));
    }

    private requireCustomer(customerId: number): void {
        if (!readStoredCustomers(this.storage).some((customer) => customer.id === customerId)) {
            throw new ApiError({ status: 404, code: "customer_not_found", message: "Customer not found", kind: "not_found" });
        }
    }

    private transactionNotFound(): ApiError {
        return new ApiError({ status: 404, code: "transaction_not_found", message: "Transaction not found", kind: "not_found" });
    }

    private alreadyVoided(): ApiError {
        return new ApiError({ status: 409, code: "transaction_already_voided", message: "Transaction already voided", kind: "conflict" });
    }

    private invalidAmount(): ApiError {
        return new ApiError({ status: 422, code: "invalid_amount", message: "Amount must be positive", kind: "validation" });
    }
}
