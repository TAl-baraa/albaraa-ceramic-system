export type StockMovementType = "in" | "out" | "adjustment";

export type StockMovement = {
    id: number;
    productId: number;
    type: StockMovementType;
    quantity: number;
    previousQuantity: number;
    newQuantity: number;
    note: string;
    createdAt: string;
};

export type StockMovementInput = Pick<
    StockMovement,
    "productId" | "type" | "quantity" | "note"
>;

export type AddStockMovementResult =
    | { success: true }
    | { success: false; error: string };
