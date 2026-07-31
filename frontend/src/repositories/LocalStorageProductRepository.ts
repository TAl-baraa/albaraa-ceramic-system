import type { Product, ProductCreateInput, ProductRecord, ProductUpdateInput } from "../types/product";
import { readStoredProducts, writeStoredProducts } from "../utils/productStorage.ts";
import type { ProductQueryOptions, ProductRepository } from "./ProductRepository";

export class LocalStorageProductRepository implements ProductRepository {
    private readonly storage: Pick<Storage, "getItem" | "setItem">;

    constructor(storage: Pick<Storage, "getItem" | "setItem"> = localStorage) {
        this.storage = storage;
    }

    private read(): Product[] {
        return readStoredProducts(this.storage);
    }

    private write(products: readonly Product[]): void {
        writeStoredProducts(products, this.storage);
    }

    async listAll(_options?: ProductQueryOptions): Promise<ProductRecord[]> {
        return this.read();
    }

    async search(searchText: string, _options?: ProductQueryOptions): Promise<ProductRecord[]> {
        const normalized = searchText.trim().toLocaleLowerCase("ar");
        return this.read().filter(
            (product) =>
                product.code.toLocaleLowerCase("ar").includes(normalized) ||
                product.name.toLocaleLowerCase("ar").includes(normalized),
        );
    }

    async getById(id: number, _options?: ProductQueryOptions): Promise<ProductRecord> {
        const product = this.read().find((candidate) => candidate.id === id);
        if (!product) throw new Error("Product not found");
        return product;
    }

    async create(
        input: ProductCreateInput,
        _options?: ProductQueryOptions,
    ): Promise<ProductRecord> {
        const products = this.read();
        const highestId = products.reduce((maximum, product) => Math.max(maximum, product.id), 0);
        const product: Product = { ...input, id: Math.max(Date.now(), highestId + 1) };
        this.write([product, ...products]);
        return product;
    }

    async update(
        id: number,
        input: ProductUpdateInput,
        _options?: ProductQueryOptions,
    ): Promise<ProductRecord> {
        const products = this.read();
        const existing = products.find((product) => product.id === id);
        if (!existing) throw new Error("Product not found");
        const updated = { ...existing, ...input };
        this.write(products.map((product) => (product.id === id ? updated : product)));
        return updated;
    }

    async remove(id: number, _options?: ProductQueryOptions): Promise<void> {
        this.write(this.read().filter((product) => product.id !== id));
    }
}
