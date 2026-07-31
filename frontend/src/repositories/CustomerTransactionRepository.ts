import type {
    Currency,
    CustomerBalanceRecord,
    CustomerTransactionCorrectionInput,
    CustomerTransactionInput,
    CustomerTransactionRecord,
    CustomerTransactionStatus,
    EditableCustomerTransactionType,
} from "../types/customer";

export type CustomerTransactionListOptions = {
    currency?: Currency;
    status?: CustomerTransactionStatus;
    transactionType?: EditableCustomerTransactionType;
    dateFrom?: string;
    dateTo?: string;
    includeVoided?: boolean;
    includeRunningBalance?: boolean;
    page?: number;
    pageSize?: number;
    signal?: AbortSignal;
};

export type CustomerTransactionPage = {
    items: CustomerTransactionRecord[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
};

export type CustomerTransactionCorrectionResult = {
    original: CustomerTransactionRecord;
    replacement: CustomerTransactionRecord;
    balances: CustomerBalanceRecord;
};

export interface CustomerTransactionRepository {
    list(customerId: number, options?: CustomerTransactionListOptions): Promise<CustomerTransactionPage>;
    create(
        customerId: number,
        input: Omit<CustomerTransactionInput, "customerId">,
        signal?: AbortSignal,
    ): Promise<CustomerTransactionRecord>;
    correct(
        customerId: number,
        transactionId: number,
        input: Omit<CustomerTransactionCorrectionInput, "transactionId">,
        signal?: AbortSignal,
    ): Promise<CustomerTransactionCorrectionResult>;
    void(
        customerId: number,
        transactionId: number,
        reason: string,
        signal?: AbortSignal,
    ): Promise<CustomerTransactionRecord>;
    getBalances(customerId: number, signal?: AbortSignal): Promise<CustomerBalanceRecord>;
}
