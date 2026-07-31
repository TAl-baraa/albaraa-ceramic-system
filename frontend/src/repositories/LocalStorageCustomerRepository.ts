import { ApiError } from "../api/apiClient.ts";
import type { Customer, CustomerBalanceRecord, CustomerInput, CustomerRecord, CustomerUpdateInput } from "../types/customer";
import {
    readStoredCustomers,
    writeStoredCustomers,
} from "../utils/customerStorage.ts";
import type { CustomerListOptions, CustomerPage, CustomerRepository } from "./CustomerRepository";
import {
    localBalanceRecord,
    makeLocalId,
    readRecalculatedTransactions,
    type CustomerStorage,
} from "./localCustomerRepositorySupport.ts";

export class LocalStorageCustomerRepository implements CustomerRepository {
    private readonly storage: CustomerStorage;

    constructor(storage: CustomerStorage = localStorage) {
        this.storage = storage;
    }

    async list(options: CustomerListOptions = {}): Promise<CustomerPage> {
        const search = options.search?.trim().toLocaleLowerCase("ar") ?? "";
        const filtered = readStoredCustomers(this.storage).filter(
            (customer) =>
                customer.name.toLocaleLowerCase("ar").includes(search) ||
                customer.phone.includes(search),
        );
        const page = options.page ?? 1;
        const pageSize = options.pageSize ?? 20;
        const transactions = options.includeBalances
            ? readRecalculatedTransactions(this.storage)
            : [];
        return {
            items: filtered.slice((page - 1) * pageSize, page * pageSize).map(
                (customer) => options.includeBalances
                    ? { ...customer, apiBalance: localBalanceRecord(customer.id, transactions) }
                    : customer,
            ),
            total: filtered.length,
            page,
            pageSize,
            totalPages: filtered.length ? Math.ceil(filtered.length / pageSize) : 0,
        };
    }

    async listAll(
        options: Omit<CustomerListOptions, "page" | "pageSize"> = {},
    ): Promise<CustomerRecord[]> {
        return (await this.list({ ...options, page: 1, pageSize: Number.MAX_SAFE_INTEGER })).items;
    }

    async getById(id: number): Promise<CustomerRecord> {
        const customer = readStoredCustomers(this.storage).find((item) => item.id === id);
        if (!customer) throw this.notFound();
        return customer;
    }

    async create(input: CustomerInput): Promise<CustomerRecord> {
        const customers = readStoredCustomers(this.storage);
        const name = input.name.trim();
        if (!name) throw new ApiError({ status: 422, code: "validation_error", message: "Customer name is required", kind: "validation" });
        const phone = input.phone.trim();
        if (phone && customers.some((customer) => customer.phone.trim() === phone)) {
            throw new ApiError({ status: 409, code: "duplicate_customer_phone", message: "Duplicate phone", kind: "conflict" });
        }
        const customer: Customer = {
            id: makeLocalId(customers.map(({ id }) => id)),
            name,
            phone,
            address: input.address.trim(),
            notes: input.notes.trim(),
            createdAt: new Date().toISOString(),
            lastPaymentAt: null,
        };
        writeStoredCustomers([customer, ...customers], this.storage);
        return customer;
    }

    async update(id: number, input: CustomerUpdateInput): Promise<CustomerRecord> {
        const customers = readStoredCustomers(this.storage);
        const existing = customers.find((customer) => customer.id === id);
        if (!existing) throw this.notFound();
        const updated: Customer = {
            ...existing,
            ...(input.name === undefined ? {} : { name: input.name.trim() }),
            ...(input.phone === undefined ? {} : { phone: input.phone.trim() }),
            ...(input.address === undefined ? {} : { address: input.address.trim() }),
            ...(input.notes === undefined ? {} : { notes: input.notes.trim() }),
        };
        if (!updated.name) throw new ApiError({ status: 422, code: "validation_error", message: "Customer name is required", kind: "validation" });
        if (
            updated.phone && customers.some(
                (customer) => customer.id !== id && customer.phone.trim() === updated.phone,
            )
        ) throw new ApiError({ status: 409, code: "duplicate_customer_phone", message: "Duplicate phone", kind: "conflict" });
        writeStoredCustomers(
            customers.map((customer) => (customer.id === id ? updated : customer)),
            this.storage,
        );
        return updated;
    }

    async remove(id: number): Promise<void> {
        const customers = readStoredCustomers(this.storage);
        if (!customers.some((customer) => customer.id === id)) throw this.notFound();
        if (readRecalculatedTransactions(this.storage).some((item) => item.customerId === id)) {
            throw new ApiError({ status: 409, code: "customer_has_transactions", message: "Customer has transactions", kind: "conflict" });
        }
        writeStoredCustomers(customers.filter((customer) => customer.id !== id), this.storage);
    }

    async getBalances(id: number): Promise<CustomerBalanceRecord> {
        await this.getById(id);
        return localBalanceRecord(id, readRecalculatedTransactions(this.storage));
    }

    private notFound(): ApiError {
        return new ApiError({ status: 404, code: "customer_not_found", message: "Customer not found", kind: "not_found" });
    }
}
