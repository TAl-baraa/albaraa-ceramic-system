import { ApiError } from "./apiClient.ts";
import { ProductMappingError } from "./products/productMappers.ts";

export function apiErrorToArabic(error: unknown): string {
    if (error instanceof ProductMappingError && error.message.includes("inventory movement")) {
        return "يجب تعديل كمية المنتج من خلال حركة مخزون.";
    }
    if (!(error instanceof ApiError)) return "حدث خطأ غير متوقع.";
    if (error.kind === "network") return "تعذر الاتصال بالخادم.";
    if (error.kind === "timeout") return "انتهت مهلة الاتصال بالخادم.";
    if (error.code === "duplicate_product_code") return "يوجد منتج آخر يحمل هذا الكود.";
    if (error.code === "product_not_found" || error.kind === "not_found") {
        return "المنتج غير موجود.";
    }
    if (error.code === "product_quantity_update_blocked") {
        return "يجب تعديل كمية المنتج من خلال حركة مخزون.";
    }
    if (error.kind === "validation") return "يرجى التحقق من البيانات المدخلة.";
    if (error.kind === "conflict") return "تعذر تنفيذ العملية بسبب تعارض في البيانات.";
    return "تعذر إكمال الطلب من الخادم.";
}
