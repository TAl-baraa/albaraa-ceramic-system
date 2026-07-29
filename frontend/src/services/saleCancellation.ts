import type { CustomerTransaction } from "../types/customer";
import type { Product } from "../types/product";
import type {
    SaleInvoice,
    SaleInvoiceItem,
} from "../types/sale";
import type { StockMovement } from "../types/stockMovement";

export type SaleCancellationPlan = {
    cancelledInvoice: SaleInvoice;
    updatedProducts: Product[];
    reversalStockMovements: StockMovement[];
    voidedCustomerTransaction: CustomerTransaction | null;
};

export type SaleCancellationResult =
    | { success: true; plan: SaleCancellationPlan }
    | { success: false; error: string };

type BuildSaleCancellationPlanInput = {
    invoice: SaleInvoice | undefined;
    items: readonly SaleInvoiceItem[];
    products: readonly Product[];
    stockMovements: readonly StockMovement[];
    customerTransactions: readonly CustomerTransaction[];
    reason: string;
    cancelledAt: string;
};

function nextIds(
    existingIds: readonly number[],
    count: number,
    timestamp: string,
) {
    let nextId = Math.max(
        Date.parse(timestamp),
        ...existingIds.map((id) => id + 1),
        1,
    );

    return Array.from({ length: count }, () => nextId++);
}

export function buildSaleCancellationPlan({
    invoice,
    items,
    products,
    stockMovements,
    customerTransactions,
    reason,
    cancelledAt,
}: BuildSaleCancellationPlanInput): SaleCancellationResult {
    const normalizedReason = reason.trim();

    if (!invoice) {
        return { success: false, error: "الفاتورة غير موجودة." };
    }

    if (!normalizedReason) {
        return {
            success: false,
            error: "سبب إلغاء الفاتورة مطلوب.",
        };
    }

    if (invoice.status !== "completed") {
        return {
            success: false,
            error:
                invoice.status === "cancelled"
                    ? "تم إلغاء الفاتورة مسبقًا."
                    : "لا يمكن إلغاء فاتورة ما زالت مسودة.",
        };
    }

    if (
        !Number.isFinite(Date.parse(cancelledAt)) ||
        invoice.cancelledAt !== null ||
        invoice.reversalStockMovementIds.length > 0 ||
        invoice.reversedCustomerTransactionId !== null
    ) {
        return {
            success: false,
            error: "تم عكس آثار هذه الفاتورة مسبقًا.",
        };
    }

    if (items.length === 0) {
        return {
            success: false,
            error: "تعذر إلغاء الفاتورة لأن عناصرها مفقودة.",
        };
    }

    const malformedItem = items.find(
        (item) =>
            !Number.isFinite(item.quantity) ||
            item.quantity <= 0 ||
            !Number.isFinite(item.unitPrice) ||
            item.unitPrice <= 0 ||
            item.invoiceId !== invoice.id,
    );

    if (malformedItem) {
        return {
            success: false,
            error: `تعذر التحقق من المنتج ${malformedItem.productCodeSnapshot} - ${malformedItem.productNameSnapshot}.`,
        };
    }

    const missingProducts = items.filter(
        (item) =>
            !products.some(
                (product) =>
                    product.id === item.productId &&
                    product.unit === item.unit,
            ),
    );

    if (missingProducts.length > 0) {
        return {
            success: false,
            error: `تعذر إرجاع المخزون للمنتجات التالية:\n${missingProducts
                .map(
                    (item) =>
                        `${item.productCodeSnapshot} - ${item.productNameSnapshot}`,
                )
                .join("\n")}`,
        };
    }

    const originalMovements = invoice.stockMovementIds.map(
        (movementId) =>
            stockMovements.find(
                (movement) => movement.id === movementId,
            ),
    );

    if (
        invoice.stockMovementIds.length !== items.length ||
        originalMovements.some(
            (movement) =>
                !movement ||
                movement.type !== "out" ||
                movement.sourceType !== "sale_invoice" ||
                movement.sourceId !== invoice.id ||
                movement.sourceReference !== invoice.invoiceNumber,
        )
    ) {
        return {
            success: false,
            error: "تعذر التحقق من حركات إخراج المخزون الأصلية.",
        };
    }

    if (
        stockMovements.some(
            (movement) =>
                movement.sourceType ===
                    "sale_invoice_cancellation" &&
                movement.sourceId === invoice.id,
        )
    ) {
        return {
            success: false,
            error: "تم إنشاء حركات عكس لهذه الفاتورة مسبقًا.",
        };
    }

    let voidedCustomerTransaction: CustomerTransaction | null = null;
    const voidReason = `إلغاء فاتورة البيع ${invoice.invoiceNumber}: ${normalizedReason}`;

    if (invoice.completionTransactionId !== null) {
        const linkedTransaction = customerTransactions.find(
            (transaction) =>
                transaction.id ===
                invoice.completionTransactionId,
        );

        if (
            !linkedTransaction ||
            linkedTransaction.sourceType !== "sale_invoice" ||
            linkedTransaction.sourceId !== invoice.id ||
            linkedTransaction.sourceReference !==
                invoice.invoiceNumber
        ) {
            return {
                success: false,
                error: "تعذر التحقق من الحركة المالية المرتبطة بالفاتورة.",
            };
        }

        if (linkedTransaction.status === "voided") {
            return {
                success: false,
                error: linkedTransaction.voidReason.startsWith(
                    `إلغاء فاتورة البيع ${invoice.invoiceNumber}:`,
                )
                    ? "تم عكس الحركة المالية لهذه الفاتورة مسبقًا."
                    : "الحركة المالية المرتبطة ملغاة بسبب آخر، ويجب مراجعتها إداريًا.",
            };
        }

        voidedCustomerTransaction = {
            ...linkedTransaction,
            status: "voided",
            voidedAt: cancelledAt,
            voidReason,
        };
    }

    const reversalIds = nextIds(
        stockMovements.map((movement) => movement.id),
        items.length,
        cancelledAt,
    );
    const updatedProducts: Product[] = [];
    const reversalStockMovements: StockMovement[] = [];

    items.forEach((item, index) => {
        const product = products.find(
            (currentProduct) =>
                currentProduct.id === item.productId,
        );

        if (!product) {
            return;
        }

        const newQuantity = Number(
            (product.quantity + item.quantity).toFixed(6),
        );

        updatedProducts.push({ ...product, quantity: newQuantity });
        reversalStockMovements.push({
            id: reversalIds[index] ?? 0,
            productId: product.id,
            type: "in",
            quantity: item.quantity,
            previousQuantity: product.quantity,
            newQuantity,
            note: `إرجاع مخزون بسبب إلغاء الفاتورة ${invoice.invoiceNumber}`,
            createdAt: cancelledAt,
            sourceType: "sale_invoice_cancellation",
            sourceId: invoice.id,
            sourceReference: invoice.invoiceNumber,
        });
    });

    return {
        success: true,
        plan: {
            cancelledInvoice: {
                ...invoice,
                status: "cancelled",
                cancelledAt,
                cancellationReason: normalizedReason,
                reversalStockMovementIds:
                    reversalStockMovements.map(
                        (movement) => movement.id,
                    ),
                reversedCustomerTransactionId:
                    voidedCustomerTransaction?.id ?? null,
                updatedAt: cancelledAt,
            },
            updatedProducts,
            reversalStockMovements,
            voidedCustomerTransaction,
        },
    };
}
