import type { Currency } from "../../types/customer";
import type { ProductUnit } from "../../types/product";
import type { SaleInvoiceStatus } from "../../types/sale";

export type SaleInvoiceItemDto = {
    id: number;
    invoiceId: number;
    productId: number;
    productCodeSnapshot: string;
    productNameSnapshot: string;
    unit: ProductUnit;
    quantity: string;
    unitPrice: string;
    total: string;
    createdAt: string;
};

export type SaleInvoiceCompletionAuditDto = {
    sourceReference: string;
    stockMovementCount: number;
    reversalMovementCount: number;
    customerTransactionCreated: boolean;
    customerTransactionVoided: boolean;
};

export type SaleInvoiceListItemDto = {
    id: number;
    invoiceNumber: string;
    customerId: number | null;
    customerNameSnapshot: string;
    currency: Currency;
    status: SaleInvoiceStatus;
    subtotal: string;
    discount: string;
    total: string;
    paidAmount: string;
    remainingAmount: string;
    itemCount: number;
    createdAt: string;
    updatedAt: string;
};

export type SaleInvoiceDto = SaleInvoiceListItemDto & {
    note: string;
    completedAt: string | null;
    cancelledAt: string | null;
    cancellationReason: string;
    completionTransactionId: number | null;
    reversedCustomerTransactionId: number | null;
    completionAudit: SaleInvoiceCompletionAuditDto;
    items: SaleInvoiceItemDto[];
};

export type SaleInvoiceListDto = {
    items: SaleInvoiceListItemDto[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
};

export type SaleDraftItemRequestDto = {
    productId: number;
    quantity: string;
    unitPrice: string;
};

export type SaleDraftCreateRequestDto = {
    customerId: number | null;
    currency: Currency;
    discount: string;
    paidAmount: string;
    note: string;
    items: SaleDraftItemRequestDto[];
};

export type SaleDraftUpdateRequestDto = Partial<SaleDraftCreateRequestDto>;
export type SaleCancellationRequestDto = { reason: string };

export type SalesSummaryDto = {
    currency: Currency;
    totalInvoiceCount: number;
    draftInvoiceCount: number;
    completedInvoiceCount: number;
    cancelledInvoiceCount: number;
    completedSalesTotal: string;
    positiveRemainingTotal: string;
};
