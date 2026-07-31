import type { ApiClient } from "../api/apiClient";
import type {
    CustomerBalanceDto,
    CustomerTransactionCorrectionResponseDto,
    CustomerTransactionDto,
    CustomerTransactionListDto,
} from "../api/customers/customerApiTypes";
import {
    customerBalanceDtoToDomain,
    customerTransactionDtoToDomain,
    transactionCorrectionToDto,
    transactionCreateToDto,
    transactionVoidToDto,
} from "../api/customers/customerMappers.ts";
import type {
    CustomerBalanceRecord,
    CustomerTransactionCorrectionInput,
    CustomerTransactionInput,
    CustomerTransactionRecord,
} from "../types/customer";
import type {
    CustomerTransactionCorrectionResult,
    CustomerTransactionListOptions,
    CustomerTransactionPage,
    CustomerTransactionRepository,
} from "./CustomerTransactionRepository";

export class ApiCustomerTransactionRepository implements CustomerTransactionRepository {
    private readonly client: ApiClient;

    constructor(client: ApiClient) {
        this.client = client;
    }

    async list(
        customerId: number,
        options: CustomerTransactionListOptions = {},
    ): Promise<CustomerTransactionPage> {
        const response = await this.client.get<CustomerTransactionListDto>(
            `/customers/${customerId}/transactions`,
            {
                signal: options.signal,
                query: {
                    currency: options.currency,
                    status: options.status,
                    transactionType: options.transactionType,
                    dateFrom: options.dateFrom,
                    dateTo: options.dateTo,
                    includeVoided: options.includeVoided ?? true,
                    includeRunningBalance: options.includeRunningBalance ?? false,
                    page: options.page ?? 1,
                    pageSize: options.pageSize ?? 20,
                },
            },
        );
        return {
            ...response,
            items: response.items.map(customerTransactionDtoToDomain),
        };
    }

    async create(
        customerId: number,
        input: Omit<CustomerTransactionInput, "customerId">,
        signal?: AbortSignal,
    ): Promise<CustomerTransactionRecord> {
        return customerTransactionDtoToDomain(
            await this.client.post<CustomerTransactionDto>(
                `/customers/${customerId}/transactions`,
                { body: transactionCreateToDto(input), signal },
            ),
        );
    }

    async correct(
        customerId: number,
        transactionId: number,
        input: Omit<CustomerTransactionCorrectionInput, "transactionId">,
        signal?: AbortSignal,
    ): Promise<CustomerTransactionCorrectionResult> {
        const response = await this.client.post<CustomerTransactionCorrectionResponseDto>(
            `/customers/${customerId}/transactions/${transactionId}/correct`,
            { body: transactionCorrectionToDto(input), signal },
        );
        return {
            original: customerTransactionDtoToDomain(response.original),
            replacement: customerTransactionDtoToDomain(response.replacement),
            balances: customerBalanceDtoToDomain(response.balances),
        };
    }

    async void(
        customerId: number,
        transactionId: number,
        reason: string,
        signal?: AbortSignal,
    ): Promise<CustomerTransactionRecord> {
        return customerTransactionDtoToDomain(
            await this.client.post<CustomerTransactionDto>(
                `/customers/${customerId}/transactions/${transactionId}/void`,
                { body: transactionVoidToDto(reason), signal },
            ),
        );
    }

    async getBalances(
        customerId: number,
        signal?: AbortSignal,
    ): Promise<CustomerBalanceRecord> {
        return customerBalanceDtoToDomain(
            await this.client.get<CustomerBalanceDto>(`/customers/${customerId}/balances`, {
                signal,
            }),
        );
    }
}
