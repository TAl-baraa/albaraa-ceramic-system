import { ApiError } from "./apiClient.ts";
import { ProductMappingError } from "./products/productMappers.ts";
import { CustomerMappingError } from "./customers/customerMappers.ts";
import { InventoryMappingError } from "./inventory/inventoryMappers.ts";

export function apiErrorToArabic(error: unknown): string {
    if (error instanceof ProductMappingError && error.message.includes("inventory movement")) {
        return "يجب تعديل الكمية من خلال حركة مخزون.";
    }
    if (error instanceof CustomerMappingError) {
        if (error.message.includes("Correction reason")) return "يجب إدخال سبب التصحيح.";
        if (error.message.includes("Void reason")) return "يجب إدخال سبب الإلغاء.";
        if (error.message.includes("amount")) return "يجب أن يكون المبلغ أكبر من صفر.";
    }
    if (error instanceof InventoryMappingError) {
        if (error.message.includes("Piece quantities")) {
            return "يجب أن تكون كمية القطع عددًا صحيحًا.";
        }
        if (error.message.includes("Adjustment note")) {
            return "يجب إدخال سبب تعديل المخزون.";
        }
        if (error.message.includes("greater than zero")) {
            return "يجب أن تكون الكمية أكبر من صفر.";
        }
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
        return "يجب تعديل الكمية من خلال حركة مخزون.";
    }
    if (error.code === "insufficient_stock") return "الكمية المتوفرة غير كافية.";
    if (error.code === "stock_movement_not_found") return "حركة المخزون غير موجودة.";
    if (error.code === "invalid_piece_quantity") return "يجب أن تكون كمية القطع عددًا صحيحًا.";
    if (error.code === "invalid_movement_quantity") return "يجب أن تكون الكمية أكبر من صفر.";
    if (error.code === "adjustment_note_required") return "يجب إدخال سبب تعديل المخزون.";
    if (error.code === "no_op_stock_adjustment") return "الكمية الجديدة مطابقة للكمية الحالية.";
    if (error.code === "product_has_stock_movements") {
        return "لا يمكن حذف المنتج لوجود حركات مخزون مرتبطة به.";
    }
    if (error.kind === "validation") return "يرجى التحقق من البيانات المدخلة.";
    if (error.kind === "conflict") return "تعذر تنفيذ العملية بسبب تعارض في البيانات.";
    return "تعذر إكمال الطلب من الخادم.";
}
