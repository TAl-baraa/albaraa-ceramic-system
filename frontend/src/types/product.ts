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
