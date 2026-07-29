export type Currency = "IQD" | "USD";

export type CustomerTransactionType =
    | "debt"
    | "credit"
    | "payment_received"
    | "payment_paid"
    | "adjustment";

export type EditableCustomerTransactionType = Exclude<
    CustomerTransactionType,
    "adjustment"
>;

export type CustomerTransactionStatus = "active" | "voided";

export type Customer = {
    id: number;
    name: string;
    phone: string;
    address: string;
    createdAt: string;
    lastPaymentAt: string | null;
    notes: string;
};

export type CustomerTransaction = {
    id: number;
    customerId: number;
    type: CustomerTransactionType;
    amount: number;
    currency: Currency;
    note: string;
    createdAt: string;
    recordedAt: string;
    balanceAfter: CustomerBalance;
    status: CustomerTransactionStatus;
    correctedTransactionId: number | null;
    voidedAt: string | null;
    voidReason: string;
    createdByCorrection: boolean;
};

export type CustomerBalance = Record<Currency, number>;

export type CustomerInput = Pick<
    Customer,
    "name" | "phone" | "address" | "notes"
>;

export type CustomerTransactionInput = Pick<
    CustomerTransaction,
    "customerId" | "type" | "amount" | "currency" | "note"
>;

export type CustomerTransactionCorrectionInput = {
    transactionId: number;
    type: EditableCustomerTransactionType;
    amount: number;
    note: string;
    reason: string;
};

export type CustomerActionResult =
    | { success: true }
    | { success: false; error: string };
