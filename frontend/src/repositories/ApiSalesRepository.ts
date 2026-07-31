import { ApiError, createApiClient, type ApiClient } from "../api/apiClient.ts";
import type {
    SaleInvoiceDto,
    SaleInvoiceListDto,
    SalesSummaryDto,
} from "../api/sales/salesApiTypes";
import {
    cancellationInputToDto,
    draftCreateInputToDto,
    draftUpdateInputToDto,
    saleInvoiceDtoToDomain,
    saleInvoiceListItemDtoToDomain,
    salesSummaryDtoToDomain,
    SalesMappingError,
} from "../api/sales/salesMappers.ts";
import type { Currency } from "../types/customer";
import type {
    SaleDraftInput,
    SaleDraftUpdateInput,
    SaleInvoiceListRecord,
    SaleInvoiceRecord,
    SalesSummary,
} from "../types/sale";
import type {
    InvoiceListOptions,
    InvoicePage,
    SalesRepository,
    SalesRequestOptions,
} from "./SalesRepository";

const MAX_PAGE_SIZE = 100;
const MAX_PAGES = 10_000;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function dateFilter(value: string | undefined, field: string): string | undefined {
    if (value === undefined) return undefined;
    const trimmed = value.trim();
    if (DATE_ONLY.test(trimmed)) return trimmed;
    if (!Number.isFinite(Date.parse(trimmed))) throw new SalesMappingError(`${field} is invalid`);
    return trimmed;
}

export class ApiSalesRepository implements SalesRepository {
    private readonly client: ApiClient;

    constructor(client: ApiClient) {
        this.client = client;
    }

    async listInvoices(options: InvoiceListOptions = {}): Promise<InvoicePage> {
        const response = await this.client.get<SaleInvoiceListDto>("/sales/invoices", {
            signal: options.signal,
            query: {
                search: options.search?.trim(),
                status: options.status,
                currency: options.currency,
                customerId: options.customerId,
                dateFrom: dateFilter(options.dateFrom, "dateFrom"),
                dateTo: dateFilter(options.dateTo, "dateTo"),
                page: options.page ?? 1,
                pageSize: options.pageSize ?? 20,
            },
        });
        return { ...response, items: response.items.map(saleInvoiceListItemDtoToDomain) };
    }

    async listAllInvoices(
        options: Omit<InvoiceListOptions, "page" | "pageSize"> = {},
    ): Promise<SaleInvoiceListRecord[]> {
        const invoices: SaleInvoiceListRecord[] = [];
        let page = 1;
        while (page <= MAX_PAGES) {
            const response = await this.listInvoices({ ...options, page, pageSize: MAX_PAGE_SIZE });
            if (
                response.page !== page || response.pageSize <= 0 || response.total < 0 ||
                response.totalPages < 0
            ) {
                throw new ApiError({
                    status: 200,
                    code: "invalid_invoice_pagination",
                    message: "The server returned invalid invoice pagination data.",
                    kind: "server",
                });
            }
            invoices.push(...response.items);
            if (
                response.items.length === 0 || invoices.length >= response.total ||
                page >= response.totalPages
            ) return invoices;
            page += 1;
        }
        throw new ApiError({
            status: 200,
            code: "invoice_pagination_limit_exceeded",
            message: "Invoice pagination did not terminate safely.",
            kind: "server",
        });
    }

    async getInvoiceById(
        id: number,
        options: SalesRequestOptions = {},
    ): Promise<SaleInvoiceRecord> {
        return saleInvoiceDtoToDomain(
            await this.client.get<SaleInvoiceDto>(`/sales/invoices/${id}`, {
                signal: options.signal,
            }),
        );
    }

    async createDraft(
        input: SaleDraftInput,
        options: SalesRequestOptions = {},
    ): Promise<SaleInvoiceRecord> {
        return saleInvoiceDtoToDomain(
            await this.client.post<SaleInvoiceDto>("/sales/invoices", {
                body: draftCreateInputToDto(input), signal: options.signal,
            }),
        );
    }

    async updateDraft(
        id: number,
        input: SaleDraftUpdateInput,
        options: SalesRequestOptions = {},
    ): Promise<SaleInvoiceRecord> {
        return saleInvoiceDtoToDomain(
            await this.client.patch<SaleInvoiceDto>(`/sales/invoices/${id}`, {
                body: draftUpdateInputToDto(input), signal: options.signal,
            }),
        );
    }

    deleteDraft(id: number, options: SalesRequestOptions = {}): Promise<void> {
        return this.client.delete(`/sales/invoices/${id}`, { signal: options.signal });
    }

    async completeInvoice(
        id: number,
        options: SalesRequestOptions = {},
    ): Promise<SaleInvoiceRecord> {
        return saleInvoiceDtoToDomain(
            await this.client.post<SaleInvoiceDto>(`/sales/invoices/${id}/complete`, {
                signal: options.signal,
            }),
        );
    }

    async cancelInvoice(
        id: number,
        reason: string,
        options: SalesRequestOptions = {},
    ): Promise<SaleInvoiceRecord> {
        return saleInvoiceDtoToDomain(
            await this.client.post<SaleInvoiceDto>(`/sales/invoices/${id}/cancel`, {
                body: cancellationInputToDto(reason), signal: options.signal,
            }),
        );
    }

    async getSummary(
        currency: Currency,
        options: SalesRequestOptions = {},
    ): Promise<SalesSummary> {
        return salesSummaryDtoToDomain(
            await this.client.get<SalesSummaryDto>("/sales/summary", {
                signal: options.signal,
                query: { currency },
            }),
        );
    }
}

export function createApiSalesRepository(baseUrl: string): ApiSalesRepository {
    return new ApiSalesRepository(createApiClient(baseUrl));
}
