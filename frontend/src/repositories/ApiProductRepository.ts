import { ApiError, createApiClient, type ApiClient } from "../api/apiClient.ts";
import type { ProductDto, ProductListDto } from "../api/products/productApiTypes";
import {
    productCreateToDto,
    productDtoToDomain,
    productUpdateToDto,
} from "../api/products/productMappers.ts";
import type { ProductCreateInput, ProductRecord, ProductUpdateInput } from "../types/product";
import type { ProductQueryOptions, ProductRepository } from "./ProductRepository";

const PAGE_SIZE = 100;
const MAX_PAGES = 10_000;

export class ApiProductRepository implements ProductRepository {
    private readonly client: ApiClient;

    constructor(client: ApiClient) {
        this.client = client;
    }

    private async listPages(
        search: string | undefined,
        options?: ProductQueryOptions,
    ): Promise<ProductRecord[]> {
        const products: ProductRecord[] = [];
        let page = 1;
        let expectedTotal: number | null = null;
        while (page <= MAX_PAGES) {
            const response = await this.client.get<ProductListDto>("/products", {
                signal: options?.signal,
                query: { page, pageSize: PAGE_SIZE, search },
            });
            if (
                response.page !== page ||
                response.pageSize <= 0 ||
                response.total < 0 ||
                response.totalPages < 0 ||
                !Array.isArray(response.items)
            ) {
                throw new ApiError({
                    status: 200,
                    code: "invalid_pagination_response",
                    message: "The server returned invalid product pagination data.",
                    kind: "server",
                });
            }
            expectedTotal ??= response.total;
            products.push(...response.items.map(productDtoToDomain));
            if (
                response.items.length === 0 ||
                products.length >= expectedTotal ||
                page >= response.totalPages
            ) {
                return products;
            }
            page += 1;
        }
        throw new ApiError({
            status: 200,
            code: "pagination_limit_exceeded",
            message: "Product pagination did not terminate safely.",
            kind: "server",
        });
    }

    listAll(options?: ProductQueryOptions): Promise<ProductRecord[]> {
        return this.listPages(undefined, options);
    }

    search(searchText: string, options?: ProductQueryOptions): Promise<ProductRecord[]> {
        return this.listPages(searchText.trim(), options);
    }

    async getById(id: number, options?: ProductQueryOptions): Promise<ProductRecord> {
        return productDtoToDomain(
            await this.client.get<ProductDto>(`/products/${id}`, { signal: options?.signal }),
        );
    }

    async create(
        input: ProductCreateInput,
        options?: ProductQueryOptions,
    ): Promise<ProductRecord> {
        return productDtoToDomain(
            await this.client.post<ProductDto>("/products", {
                signal: options?.signal,
                body: productCreateToDto(input),
            }),
        );
    }

    async update(
        id: number,
        input: ProductUpdateInput,
        options?: ProductQueryOptions,
    ): Promise<ProductRecord> {
        return productDtoToDomain(
            await this.client.patch<ProductDto>(`/products/${id}`, {
                signal: options?.signal,
                body: productUpdateToDto(input),
            }),
        );
    }

    remove(id: number, options?: ProductQueryOptions): Promise<void> {
        return this.client.delete(`/products/${id}`, { signal: options?.signal });
    }
}

export function createApiProductRepository(baseUrl: string): ApiProductRepository {
    return new ApiProductRepository(createApiClient(baseUrl));
}
