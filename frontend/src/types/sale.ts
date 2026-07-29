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
