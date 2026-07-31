import type { Currency } from "./customer";
import type { ProductUnit } from "./product";

export type SaleInvoiceStatus =
    | "draft"
    | "completed"
    | "cancelled";

export type SaleInvoice = {
    id: number;
    invoiceNumber: string;
    customerId: number | null;
    customerNameSnapshot: string;
    currency: Currency;
    status: SaleInvoiceStatus;
    subtotal: number;
    discount: number;
    total: number;
    paidAmount: number;
    remainingAmount: number;
    note: string;
    createdAt: string;
    updatedAt: string;
    completedAt: string | null;
    completionTransactionId: number | null;
    stockMovementIds: number[];
    cancelledAt: string | null;
    cancellationReason: string;
    reversalStockMovementIds: number[];
    reversedCustomerTransactionId: number | null;
};

export type SaleInvoiceItem = {
    id: number;
    invoiceId: number;
    productId: number;
    productCodeSnapshot: string;
    productNameSnapshot: string;
    unit: ProductUnit;
    quantity: number;
    unitPrice: number;
    total: number;
};

export type SaleInvoiceItemRecord = SaleInvoiceItem & {
    apiCreatedAt?: string;
};

export type SaleInvoiceCompletionAudit = {
    sourceReference: string;
    stockMovementCount: number;
    reversalMovementCount: number;
    customerTransactionCreated: boolean;
    customerTransactionVoided: boolean;
};

export type SaleInvoiceRecord = SaleInvoice & {
    items: SaleInvoiceItemRecord[];
    itemCount: number;
    completionAudit: SaleInvoiceCompletionAudit;
};

export type SaleDraftItemInput = {
    productId: number;
    quantity: number;
    unitPrice: number;
    unit?: ProductUnit;
};

export type SaleDraftInput = {
    customerId: number | null;
    currency: Currency;
    discount: number;
    paidAmount: number;
    note: string;
    items: SaleDraftItemInput[];
};

export type SaleDraftUpdateInput = Partial<SaleDraftInput>;

export type SalesSummary = {
    currency: Currency;
    totalInvoiceCount: number;
    draftInvoiceCount: number;
    completedInvoiceCount: number;
    cancelledInvoiceCount: number;
    completedSalesTotal: number;
    positiveRemainingTotal: number;
};

export type SaleInvoiceListRecord = Pick<
    SaleInvoice,
    | "id"
    | "invoiceNumber"
    | "customerId"
    | "customerNameSnapshot"
    | "currency"
    | "status"
    | "subtotal"
    | "discount"
    | "total"
    | "paidAmount"
    | "remainingAmount"
    | "createdAt"
    | "updatedAt"
> & { itemCount: number };
