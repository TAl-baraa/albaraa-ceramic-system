import type { Currency } from "../types/customer";
import type { SaleInvoiceStatus } from "../types/sale";
import { getRemainingPresentation } from "./salePresentation.ts";

export const UNSAVED_API_INVOICE_NUMBER = "سيُنشأ عند الحفظ";

export function saleInvoiceStatusLabel(status: SaleInvoiceStatus): string {
    return status === "draft" ? "مسودة" : status === "completed" ? "مكتملة" : "ملغاة";
}

export function saleRemainingLabel(amount: number, currency: Currency): string {
    return getRemainingPresentation(amount, currency).label;
}
