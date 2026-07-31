export type ProductUnit = "متر مربع" | "قطعة";

export type Product = {
    id: number;
    code: string;
    name: string;
    size: string;
    company: string;
    unit: ProductUnit;
    quantity: number;
    minimumQuantity: number;
    sellPriceIqd: number;
    purchasePriceUsd: number;
};

export type ProductCreateInput = Omit<Product, "id">;
export type ProductUpdateInput = Partial<ProductCreateInput>;

export type ProductApiMetadata = {
    createdAt: string;
    updatedAt: string;
};

export type ProductRecord = Product & {
    apiMetadata?: ProductApiMetadata;
};
