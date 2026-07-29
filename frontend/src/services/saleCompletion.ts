import type { Customer, CustomerTransaction } from "../types/customer";
import type { Product } from "../types/product";
import type {
    SaleInvoice,
    SaleInvoiceItem,
} from "../types/sale";
import type { StockMovement } from "../types/stockMovement";
import {
    calculateInvoiceTotals,
    calculateLineTotal,
    calculateSubtotal,
    validateSaleQuantity,
} from "../utils/salesCalculations.ts";

export type SaleCompletionPlan = {
    completedInvoice: SaleInvoice;
    updatedProducts: Product[];
    stockMovements: StockMovement[];
    customerTransaction: CustomerTransaction | null;
};

export type SaleCompletionResult =
    | { success: true; plan: SaleCompletionPlan }
    | { success: false; error: string };

type BuildSaleCompletionPlanInput = {
    invoice: SaleInvoice | undefined;
    invoices: readonly SaleInvoice[];
    items: readonly SaleInvoiceItem[];
    products: readonly Product[];
    customers: readonly Customer[];
    stockMovements: readonly StockMovement[];
    customerTransactions: readonly CustomerTransaction[];
    completedAt: string;
};

function amountsEqual(first: number, second: number) {
    return Math.abs(first - second) < 0.000001;
}

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

function formatStockProblems(
    problems: {
        item: SaleInvoiceItem;
        available: number;
        reason: string;
    }[],
) {
    return problems
        .map(
            ({ item, available, reason }) =>
                `${item.productCodeSnapshot} - ${item.productNameSnapshot}: ${reason} (المطلوب ${item.quantity}، المتوفر ${available} ${item.unit})`,
        )
        .join("\n");
}

export function buildSaleCompletionPlan({
    invoice,
    invoices,
    items,
    products,
    customers,
    stockMovements,
    customerTransactions,
    completedAt,
}: BuildSaleCompletionPlanInput): SaleCompletionResult {
    if (!invoice) {
        return { success: false, error: "الفاتورة غير موجودة." };
    }

    if (invoice.status !== "draft") {
        return {
            success: false,
            error: "تم اعتماد الفاتورة مسبقًا أو أنها ليست مسودة.",
        };
    }

    if (
        !Number.isFinite(Date.parse(completedAt)) ||
        !(invoice.currency === "IQD" || invoice.currency === "USD")
    ) {
        return {
            success: false,
            error: "بيانات الفاتورة المخزنة غير صالحة.",
        };
    }

    if (
        invoices.some(
            (otherInvoice) =>
                otherInvoice.id !== invoice.id &&
                otherInvoice.invoiceNumber ===
                    invoice.invoiceNumber,
        )
    ) {
        return {
            success: false,
            error: "رقم الفاتورة مكرر ولا يمكن اعتمادها.",
        };
    }

    if (items.length === 0) {
        return {
            success: false,
            error: "لا يمكن اعتماد فاتورة دون منتجات.",
        };
    }

    if (
        new Set(items.map((item) => item.productId)).size !==
        items.length
    ) {
        return {
            success: false,
            error: "تحتوي الفاتورة على منتجات مكررة.",
        };
    }

    if (
        stockMovements.some(
            (movement) =>
                movement.sourceType === "sale_invoice" &&
                movement.sourceId === invoice.id,
        ) ||
        customerTransactions.some(
            (transaction) =>
                transaction.sourceType === "sale_invoice" &&
                transaction.sourceId === invoice.id,
        )
    ) {
        return {
            success: false,
            error: "تم ترحيل آثار هذه الفاتورة مسبقًا.",
        };
    }

    const stockProblems: {
        item: SaleInvoiceItem;
        available: number;
        reason: string;
    }[] = [];

    for (const item of items) {
        const product = products.find(
            (currentProduct) =>
                currentProduct.id === item.productId,
        );

        if (!product) {
            stockProblems.push({
                item,
                available: 0,
                reason: "المنتج محذوف من المخزون",
            });
            continue;
        }

        if (product.unit !== item.unit) {
            stockProblems.push({
                item,
                available: product.quantity,
                reason: "تغيرت وحدة قياس المنتج",
            });
            continue;
        }

        const quantityError = validateSaleQuantity(
            item.quantity,
            item.unit,
            product.quantity,
        );

        if (quantityError) {
            stockProblems.push({
                item,
                available: product.quantity,
                reason: quantityError,
            });
        }

        if (
            !Number.isFinite(item.unitPrice) ||
            item.unitPrice <= 0 ||
            !amountsEqual(
                item.total,
                calculateLineTotal(item.quantity, item.unitPrice),
            )
        ) {
            stockProblems.push({
                item,
                available: product.quantity,
                reason: "سعر الوحدة أو إجمالي السطر غير صالح",
            });
        }
    }

    if (stockProblems.length > 0) {
        return {
            success: false,
            error: `تعذر اعتماد الفاتورة:\n${formatStockProblems(
                stockProblems,
            )}`,
        };
    }

    const subtotal = calculateSubtotal(items);
    const calculatedTotals = calculateInvoiceTotals(
        subtotal,
        invoice.discount,
        invoice.paidAmount,
    );

    if (
        !Number.isFinite(invoice.discount) ||
        invoice.discount < 0 ||
        invoice.discount > subtotal ||
        !Number.isFinite(invoice.paidAmount) ||
        invoice.paidAmount < 0 ||
        !amountsEqual(invoice.subtotal, subtotal) ||
        !amountsEqual(invoice.total, calculatedTotals.total) ||
        !amountsEqual(
            invoice.remainingAmount,
            calculatedTotals.remainingAmount,
        )
    ) {
        return {
            success: false,
            error: "مجاميع الفاتورة أو مبالغها غير صالحة.",
        };
    }

    if (
        invoice.customerId === null &&
        invoice.remainingAmount > 0
    ) {
        return {
            success: false,
            error: "لا يمكن اعتماد بيع نقدي مع مبلغ متبقٍ دون اختيار عميل.",
        };
    }

    if (
        invoice.customerId !== null &&
        !customers.some(
            (customer) => customer.id === invoice.customerId,
        )
    ) {
        return {
            success: false,
            error: "العميل المرتبط بالفاتورة غير موجود.",
        };
    }

    const movementIds = nextIds(
        stockMovements.map((movement) => movement.id),
        items.length,
        completedAt,
    );
    const updatedProducts: Product[] = [];
    const plannedMovements: StockMovement[] = [];

    items.forEach((item, index) => {
        const product = products.find(
            (currentProduct) =>
                currentProduct.id === item.productId,
        );

        if (!product) {
            return;
        }

        const newQuantity = Number(
            (product.quantity - item.quantity).toFixed(6),
        );

        updatedProducts.push({ ...product, quantity: newQuantity });
        plannedMovements.push({
            id: movementIds[index] ?? 0,
            productId: product.id,
            type: "out",
            quantity: item.quantity,
            previousQuantity: product.quantity,
            newQuantity,
            note: `بيع بموجب الفاتورة ${invoice.invoiceNumber}`,
            createdAt: completedAt,
            sourceType: "sale_invoice",
            sourceId: invoice.id,
            sourceReference: invoice.invoiceNumber,
        });
    });

    let customerTransaction: CustomerTransaction | null = null;

    if (
        invoice.customerId !== null &&
        !amountsEqual(invoice.remainingAmount, 0)
    ) {
        const transactionId =
            nextIds(
                customerTransactions.map(
                    (transaction) => transaction.id,
                ),
                1,
                completedAt,
            )[0] ?? 1;
        const isDebt = invoice.remainingAmount > 0;

        customerTransaction = {
            id: transactionId,
            customerId: invoice.customerId,
            type: isDebt ? "debt" : "credit",
            amount: Math.abs(invoice.remainingAmount),
            currency: invoice.currency,
            note: isDebt
                ? `متبقي فاتورة البيع ${invoice.invoiceNumber}`
                : `مبلغ زائد من فاتورة البيع ${invoice.invoiceNumber}`,
            createdAt: completedAt,
            recordedAt: completedAt,
            balanceAfter: { IQD: 0, USD: 0 },
            status: "active",
            correctedTransactionId: null,
            voidedAt: null,
            voidReason: "",
            createdByCorrection: false,
            sourceType: "sale_invoice",
            sourceId: invoice.id,
            sourceReference: invoice.invoiceNumber,
        };
    }

    return {
        success: true,
        plan: {
            completedInvoice: {
                ...invoice,
                status: "completed",
                completedAt,
                updatedAt: completedAt,
                completionTransactionId:
                    customerTransaction?.id ?? null,
                stockMovementIds: plannedMovements.map(
                    (movement) => movement.id,
                ),
            },
            updatedProducts,
            stockMovements: plannedMovements,
            customerTransaction,
        },
    };
}
