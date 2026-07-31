export type ApiCurrency = "IQD" | "USD";
export type ApiBalanceStatus = "owes_store" | "store_owes" | "settled";
export type ApiTransactionType = "debt" | "credit" | "payment_received" | "payment_paid";
export type ApiTransactionStatus = "active" | "voided";
export type ApiTransactionSourceType = "manual" | "sale_invoice";

export type CustomerBalanceValueDto = {
    balance: string;
    status: ApiBalanceStatus;
};

export type CustomerBalanceDto = {
    customerId: number;
    IQD: CustomerBalanceValueDto;
    USD: CustomerBalanceValueDto;
};

export type CustomerDto = {
    id: number;
    name: string;
    phone: string;
    address: string;
    notes: string;
    createdAt: string;
    updatedAt: string;
    lastPaymentAt: string | null;
    balances: CustomerBalanceDto | null;
};

export type CustomerListDto = {
    items: CustomerDto[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
};

export type CustomerCreateDto = {
    name: string;
    phone: string;
    address: string;
    notes: string;
};

export type CustomerUpdateDto = Partial<CustomerCreateDto>;

export type CustomerTransactionDto = {
    id: number;
    customerId: number;
    transactionType: ApiTransactionType;
    amount: string;
    currency: ApiCurrency;
    note: string;
    status: ApiTransactionStatus;
    correctedTransactionId: number | null;
    voidedAt: string | null;
    voidReason: string;
    createdByCorrection: boolean;
    sourceType: ApiTransactionSourceType;
    sourceId: number | null;
    sourceReference: string;
    createdAt: string;
    recordedAt: string;
    updatedAt: string;
    effectAmount: string;
    runningBalance: string | null;
};

export type CustomerTransactionListDto = {
    items: CustomerTransactionDto[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
};

export type CustomerTransactionCreateDto = {
    transactionType: ApiTransactionType;
    amount: string;
    currency: ApiCurrency;
    note: string;
};

export type CustomerTransactionCorrectionDto = {
    transactionType: ApiTransactionType;
    amount: string;
    note: string;
    reason: string;
};

export type CustomerTransactionVoidDto = { reason: string };

export type CustomerTransactionCorrectionResponseDto = {
    original: CustomerTransactionDto;
    replacement: CustomerTransactionDto;
    balances: CustomerBalanceDto;
};
