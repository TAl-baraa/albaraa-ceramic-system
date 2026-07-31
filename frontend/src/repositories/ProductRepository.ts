import type {
    ProductCreateInput,
    ProductRecord,
    ProductUpdateInput,
} from "../types/product";

export type ProductQueryOptions = {
    signal?: AbortSignal;
};

export interface ProductRepository {
    listAll(options?: ProductQueryOptions): Promise<ProductRecord[]>;
    search(searchText: string, options?: ProductQueryOptions): Promise<ProductRecord[]>;
    getById(id: number, options?: ProductQueryOptions): Promise<ProductRecord>;
    create(input: ProductCreateInput, options?: ProductQueryOptions): Promise<ProductRecord>;
    update(
        id: number,
        input: ProductUpdateInput,
        options?: ProductQueryOptions,
    ): Promise<ProductRecord>;
    remove(id: number, options?: ProductQueryOptions): Promise<void>;
}
