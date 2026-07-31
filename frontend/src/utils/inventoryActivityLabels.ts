import type { StockMovementRecord } from "../types/stockMovement";
import { formatQuantity, normalizeWesternDigits } from "./formatters.ts";

export function inventoryActivityLabel(movement: StockMovementRecord): string {
    const reference = normalizeWesternDigits(movement.sourceReference);
    if (movement.sourceType === "sale_invoice") {
        return reference
            ? `بيع بموجب الفاتورة ${reference}`
            : "بيع بموجب فاتورة";
    }
    if (movement.sourceType === "sale_invoice_cancellation") {
        return reference
            ? `عكس مخزون بسبب إلغاء الفاتورة ${reference}`
            : "عكس مخزون بسبب إلغاء فاتورة";
    }

    const code = normalizeWesternDigits(
        movement.productCode || movement.productName || "منتج محذوف",
    );
    if (movement.type === "adjustment") {
        return `تعديل مخزون المنتج ${code} من ${formatQuantity(movement.previousQuantity)} إلى ${formatQuantity(movement.newQuantity)}`;
    }
    const action = movement.type === "in" ? "إدخال" : "إخراج";
    const unit = movement.productUnit === "قطعة" && movement.quantity !== 1
        ? "قطع"
        : movement.productUnit ?? "";
    return `${action} ${formatQuantity(movement.quantity)} ${unit} ${
        movement.type === "in" ? "إلى" : "من"
    } المنتج ${code}`.replace(/\s+/g, " ");
}
