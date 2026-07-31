import type { Currency } from "../types/customer";
import type {
    SaleDraftInput,
    SaleDraftUpdateInput,
    SaleInvoiceListRecord,
    SaleInvoiceRecord,
    SaleInvoiceStatus,
    SalesSummary,
} from "../types/sale";

export type SalesRequestOptions = { signal?: AbortSignal };

export type InvoiceListOptions = SalesRequestOptions & {
    search?: string;
    status?: SaleInvoiceStatus;
    currency?: Currency;
    customerId?: number;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    pageSize?: number;
};

export type InvoicePage = {
    items: SaleInvoiceListRecord[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
};

export interface SalesRepository {
    listInvoices(options?: InvoiceListOptions): Promise<InvoicePage>;
    listAllInvoices(options?: Omit<InvoiceListOptions, "page" | "pageSize">): Promise<SaleInvoiceListRecord[]>;
    getInvoiceById(id: number, options?: SalesRequestOptions): Promise<SaleInvoiceRecord>;
    createDraft(input: SaleDraftInput, options?: SalesRequestOptions): Promise<SaleInvoiceRecord>;
    updateDraft(id: number, input: SaleDraftUpdateInput, options?: SalesRequestOptions): Promise<SaleInvoiceRecord>;
    deleteDraft(id: number, options?: SalesRequestOptions): Promise<void>;
    completeInvoice(id: number, options?: SalesRequestOptions): Promise<SaleInvoiceRecord>;
    cancelInvoice(id: number, reason: string, options?: SalesRequestOptions): Promise<SaleInvoiceRecord>;
    getSummary(currency: Currency, options?: SalesRequestOptions): Promise<SalesSummary>;
}
