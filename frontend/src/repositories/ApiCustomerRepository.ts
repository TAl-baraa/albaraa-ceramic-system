import { ApiError, createApiClient, type ApiClient } from "../api/apiClient.ts";
import type { CustomerBalanceDto, CustomerDto, CustomerListDto } from "../api/customers/customerApiTypes";
import {
    customerBalanceDtoToDomain,
    customerCreateToDto,
    customerDtoToDomain,
    customerUpdateToDto,
} from "../api/customers/customerMappers.ts";
import type { CustomerBalanceRecord, CustomerInput, CustomerRecord, CustomerUpdateInput } from "../types/customer";
import type { CustomerListOptions, CustomerPage, CustomerRepository } from "./CustomerRepository";

const MAX_PAGE_SIZE = 100;
const MAX_PAGES = 10_000;

export class ApiCustomerRepository implements CustomerRepository {
    private readonly client: ApiClient;

    constructor(client: ApiClient) {
        this.client = client;
    }

    async list(options: CustomerListOptions = {}): Promise<CustomerPage> {
        const response = await this.client.get<CustomerListDto>("/customers", {
            signal: options.signal,
            query: {
                search: options.search?.trim(),
                page: options.page ?? 1,
                pageSize: options.pageSize ?? 20,
                includeBalances: options.includeBalances ?? false,
            },
        });
        return {
            ...response,
            items: response.items.map(customerDtoToDomain),
        };
    }

    async listAll(
        options: Omit<CustomerListOptions, "page" | "pageSize"> = {},
    ): Promise<CustomerRecord[]> {
        const customers: CustomerRecord[] = [];
        let page = 1;
        while (page <= MAX_PAGES) {
            const response = await this.list({ ...options, page, pageSize: MAX_PAGE_SIZE });
            if (
                response.page !== page || response.pageSize <= 0 || response.total < 0 ||
                response.totalPages < 0
            ) {
                throw new ApiError({
                    status: 200,
                    code: "invalid_customer_pagination",
                    message: "The server returned invalid customer pagination data.",
                    kind: "server",
                });
            }
            customers.push(...response.items);
            if (
                response.items.length === 0 ||
                customers.length >= response.total ||
                page >= response.totalPages
            ) return customers;
            page += 1;
        }
        throw new ApiError({
            status: 200,
            code: "customer_pagination_limit_exceeded",
            message: "Customer pagination did not terminate safely.",
            kind: "server",
        });
    }

    async getById(
        id: number,
        options: { includeBalances?: boolean; signal?: AbortSignal } = {},
    ): Promise<CustomerRecord> {
        return customerDtoToDomain(
            await this.client.get<CustomerDto>(`/customers/${id}`, {
                signal: options.signal,
                query: { includeBalances: options.includeBalances ?? false },
            }),
        );
    }

    async create(input: CustomerInput, signal?: AbortSignal): Promise<CustomerRecord> {
        return customerDtoToDomain(
            await this.client.post<CustomerDto>("/customers", {
                body: customerCreateToDto(input), signal,
            }),
        );
    }

    async update(
        id: number,
        input: CustomerUpdateInput,
        signal?: AbortSignal,
    ): Promise<CustomerRecord> {
        return customerDtoToDomain(
            await this.client.patch<CustomerDto>(`/customers/${id}`, {
                body: customerUpdateToDto(input), signal,
            }),
        );
    }

    remove(id: number, signal?: AbortSignal): Promise<void> {
        return this.client.delete(`/customers/${id}`, { signal });
    }

    async getBalances(id: number, signal?: AbortSignal): Promise<CustomerBalanceRecord> {
        return customerBalanceDtoToDomain(
            await this.client.get<CustomerBalanceDto>(`/customers/${id}/balances`, { signal }),
        );
    }
}

export function createApiCustomerRepository(baseUrl: string): ApiCustomerRepository {
    return new ApiCustomerRepository(createApiClient(baseUrl));
}
