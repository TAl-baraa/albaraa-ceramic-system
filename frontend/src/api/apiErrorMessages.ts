import { ApiError } from "./apiClient.ts";
import { ProductMappingError } from "./products/productMappers.ts";
import { CustomerMappingError } from "./customers/customerMappers.ts";

export function apiErrorToArabic(error: unknown): string {
    if (error instanceof ProductMappingError && error.message.includes("inventory movement")) {
        return "يجب تعديل كمية المنتج من خلال حركة مخزون.";
    }
    if (error instanceof CustomerMappingError) {
        if (error.message.includes("Correction reason")) return "يجب إدخال سبب التصحيح.";
        if (error.message.includes("Void reason")) return "يجب إدخال سبب الإلغاء.";
        if (error.message.includes("amount")) return "يجب أن يكون المبلغ أكبر من صفر.";
    }
    if (!(error instanceof ApiError)) return "حدث خطأ غير متوقع.";
    if (error.kind === "network") return "تعذر الاتصال بالخادم.";
    if (error.kind === "timeout") return "انتهت مهلة الاتصال بالخادم.";
    if (error.code === "duplicate_product_code") return "يوجد منتج آخر يحمل هذا الكود.";
    if (error.code === "product_not_found" || error.kind === "not_found") {
        if (error.code === "customer_not_found") return "العميل غير موجود.";
        if (error.code === "transaction_not_found") return "الحركة المالية غير موجودة.";
        return "المنتج غير موجود.";
    }
    if (error.code === "customer_has_transactions") {
        return "لا يمكن حذف العميل لوجود حركات مالية مرتبطة به.";
    }
    if (error.code === "transaction_already_voided") return "هذه الحركة ملغاة بالفعل.";
    if (error.code === "source_linked_transaction_protected") {
        return "يجب تعديل الحركة المرتبطة بالفاتورة من خلال إجراءات الفاتورة.";
    }
    if (error.code === "correction_reason_required") return "يجب إدخال سبب التصحيح.";
    if (error.code === "void_reason_required") return "يجب إدخال سبب الإلغاء.";
    if (error.code === "invalid_amount") return "يجب أن يكون المبلغ أكبر من صفر.";
    if (error.code === "product_quantity_update_blocked") {
        return "يجب تعديل كمية المنتج من خلال حركة مخزون.";
    }
    if (error.kind === "validation") return "يرجى التحقق من البيانات المدخلة.";
    if (error.kind === "conflict") return "تعذر تنفيذ العملية بسبب تعارض في البيانات.";
    return "تعذر إكمال الطلب من الخادم.";
}
