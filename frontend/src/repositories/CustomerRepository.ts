import type {
    CustomerBalanceRecord,
    CustomerInput,
    CustomerRecord,
    CustomerUpdateInput,
} from "../types/customer";

export type CustomerListOptions = {
    search?: string;
    page?: number;
    pageSize?: number;
    includeBalances?: boolean;
    signal?: AbortSignal;
};

export type CustomerPage = {
    items: CustomerRecord[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
};

export interface CustomerRepository {
    list(options?: CustomerListOptions): Promise<CustomerPage>;
    listAll(options?: Omit<CustomerListOptions, "page" | "pageSize">): Promise<CustomerRecord[]>;
    getById(id: number, options?: { includeBalances?: boolean; signal?: AbortSignal }): Promise<CustomerRecord>;
    create(input: CustomerInput, signal?: AbortSignal): Promise<CustomerRecord>;
    update(id: number, input: CustomerUpdateInput, signal?: AbortSignal): Promise<CustomerRecord>;
    remove(id: number, signal?: AbortSignal): Promise<void>;
    getBalances(id: number, signal?: AbortSignal): Promise<CustomerBalanceRecord>;
}
