import type { ProductUnit } from "../../types/product";

export type ProductDto = {
    id: number;
    code: string;
    name: string;
    size: string;
    company: string;
    unit: ProductUnit;
    quantity: string;
    minimumQuantity: string;
    sellPriceIqd: string;
    purchasePriceUsd: string;
    createdAt: string;
    updatedAt: string;
};

export type ProductListDto = {
    items: ProductDto[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
};

export type ProductCreateDto = {
    code: string;
    name: string;
    size: string;
    company: string;
    unit: ProductUnit;
    quantity: string;
    minimumQuantity: string;
    sellPriceIqd: string;
    purchasePriceUsd: string;
};

export type ProductUpdateDto = Partial<Omit<ProductCreateDto, "quantity">>;
