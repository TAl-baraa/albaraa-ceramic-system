import type {
    Currency,
    Customer,
    CustomerTransaction,
} from "../types/customer";
import type { Product } from "../types/product";
import type { SaleInvoice } from "../types/sale";
import type { StockMovement } from "../types/stockMovement";
import { calculateCustomerNetBalance } from "./customerBalance.ts";
import {
    formatQuantity,
    normalizeWesternDigits,
} from "./formatters.ts";

export type DashboardSalesSummary = {
    todaySales: number;
    monthlySales: number;
    remainingTotal: number;
    completedCount: number;
};

export type DashboardCustomerSummary = {
    receivables: number;
    payables: number;
};

export type DashboardActivity = {
    key: string;
    title: string;
    reference: string;
    timestamp: string;
    detail: string;
    target: string;
    kind: "sale" | "inventory" | "customer";
};

function validDate(value: string | null | undefined) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date : null;
}

export function isSameLocalDay(first: Date, second: Date) {
    return (
        first.getFullYear() === second.getFullYear() &&
        first.getMonth() === second.getMonth() &&
        first.getDate() === second.getDate()
    );
}

export function isSameLocalMonth(first: Date, second: Date) {
    return (
        first.getFullYear() === second.getFullYear() &&
        first.getMonth() === second.getMonth()
    );
}

export function getDashboardSalesSummary(
    invoices: readonly SaleInvoice[],
    currency: Currency,
    now = new Date(),
): DashboardSalesSummary {
    const completed = invoices.filter(
        (invoice) =>
            invoice.status === "completed" &&
            invoice.currency === currency,
    );

    return completed.reduce<DashboardSalesSummary>(
        (summary, invoice) => {
            const reportingDate =
                validDate(invoice.completedAt) ??
                validDate(invoice.createdAt);
            return {
                todaySales:
                    summary.todaySales +
                    (reportingDate &&
                    isSameLocalDay(reportingDate, now)
                        ? invoice.total
                        : 0),
                monthlySales:
                    summary.monthlySales +
                    (reportingDate &&
                    isSameLocalMonth(reportingDate, now)
                        ? invoice.total
                        : 0),
                remainingTotal:
                    summary.remainingTotal +
                    Math.max(invoice.remainingAmount, 0),
                completedCount: summary.completedCount + 1,
            };
        },
        {
            todaySales: 0,
            monthlySales: 0,
            remainingTotal: 0,
            completedCount: 0,
        },
    );
}

export function getDashboardCustomerSummary(
    customers: readonly Customer[],
    transactions: readonly CustomerTransaction[],
    currency: Currency,
): DashboardCustomerSummary {
    return customers.reduce<DashboardCustomerSummary>(
        (summary, customer) => {
            const balance = calculateCustomerNetBalance(
                transactions,
                customer.id,
            )[currency];
            return {
                receivables:
                    summary.receivables + Math.max(balance, 0),
                payables:
                    summary.payables +
                    Math.abs(Math.min(balance, 0)),
            };
        },
        { receivables: 0, payables: 0 },
    );
}

export function getInventoryWarnings(
    products: readonly Product[],
    limit = 5,
) {
    return products
        .filter(
            (product) =>
                product.quantity <= 0 ||
                product.quantity <= product.minimumQuantity,
        )
        .toSorted((first, second) => {
            const firstOut = first.quantity <= 0;
            const secondOut = second.quantity <= 0;
            if (firstOut !== secondOut) return firstOut ? -1 : 1;

            const firstRatio =
                first.minimumQuantity > 0
                    ? first.quantity / first.minimumQuantity
                    : first.quantity;
            const secondRatio =
                second.minimumQuantity > 0
                    ? second.quantity / second.minimumQuantity
                    : second.quantity;
            return firstRatio - secondRatio || first.quantity - second.quantity;
        })
        .slice(0, limit);
}

function customerTransactionTitle(
    transaction: CustomerTransaction,
    customerName: string,
) {
    if (transaction.status === "voided") {
        return `تم إلغاء حركة مالية للعميل ${customerName}`;
    }

    const labels: Record<CustomerTransaction["type"], string> = {
        debt: "تم تسجيل دين على العميل",
        credit: "تم تسجيل رصيد للعميل",
        payment_received: "تم تسجيل دفعة مستلمة من العميل",
        payment_paid: "تم تسجيل دفعة مدفوعة للعميل",
        adjustment: "تم تسجيل تصحيح لحساب العميل",
    };
    return `${labels[transaction.type]} ${customerName}`;
}

export function getDashboardActivities({
    invoices,
    products,
    stockMovements,
    customers,
    transactions,
    limit = 8,
}: {
    invoices: readonly SaleInvoice[];
    products: readonly Product[];
    stockMovements: readonly StockMovement[];
    customers: readonly Customer[];
    transactions: readonly CustomerTransaction[];
    limit?: number;
}): DashboardActivity[] {
    const productById = new Map(
        products.map((product) => [product.id, product]),
    );
    const customerById = new Map(
        customers.map((customer) => [customer.id, customer]),
    );

    const invoiceActivities = invoices.flatMap<DashboardActivity>(
        (invoice) => {
            if (invoice.status === "completed") {
                return [
                    {
                        key: `sale-completed-${invoice.id}`,
                        title: `تم اعتماد فاتورة بيع ${normalizeWesternDigits(invoice.invoiceNumber)}`,
                        reference:
                            invoice.customerNameSnapshot || "بيع نقدي",
                        timestamp:
                            invoice.completedAt ?? invoice.createdAt,
                        detail: `${invoice.currency} ${invoice.total}`,
                        target: `/sales/${invoice.id}`,
                        kind: "sale",
                    },
                ];
            }
            if (invoice.status === "cancelled") {
                return [
                    {
                        key: `sale-cancelled-${invoice.id}`,
                        title: `تم إلغاء فاتورة بيع ${normalizeWesternDigits(invoice.invoiceNumber)}`,
                        reference:
                            invoice.customerNameSnapshot || "بيع نقدي",
                        timestamp:
                            invoice.cancelledAt ??
                            invoice.updatedAt ??
                            invoice.createdAt,
                        detail: `${invoice.currency} ${invoice.total}`,
                        target: `/sales/${invoice.id}`,
                        kind: "sale",
                    },
                ];
            }
            return [];
        },
    );

    const inventoryActivities = stockMovements.map<DashboardActivity>(
        (movement) => {
            const product = productById.get(movement.productId);
            const code = product?.code || movement.sourceReference || "منتج محذوف";
            const typeLabel =
                movement.type === "in"
                    ? "دخول"
                    : movement.type === "out"
                      ? "خروج"
                      : "تصحيح";
            return {
                key: `inventory-${movement.id}`,
                title: `${typeLabel} ${formatQuantity(movement.quantity)} ${product?.unit ?? ""} من المنتج ${code}`,
                reference: movement.note || code,
                timestamp: movement.createdAt,
                detail: "",
                target: "/inventory",
                kind: "inventory",
            };
        },
    );

    const customerActivities = transactions.map<DashboardActivity>(
        (transaction) => {
            const customerName =
                customerById.get(transaction.customerId)?.name ??
                "عميل محذوف";
            return {
                key: `customer-${transaction.id}-${transaction.status}`,
                title: customerTransactionTitle(
                    transaction,
                    customerName,
                ),
                reference:
                    normalizeWesternDigits(transaction.sourceReference) ||
                    transaction.note ||
                    customerName,
                timestamp:
                    transaction.status === "voided"
                        ? transaction.voidedAt ??
                          transaction.createdAt
                        : transaction.createdAt,
                detail: `${transaction.currency} ${transaction.amount}`,
                target: "/customers",
                kind: "customer",
            };
        },
    );

    return [
        ...invoiceActivities,
        ...inventoryActivities,
        ...customerActivities,
    ]
        .filter(
            (activity) =>
                validDate(activity.timestamp) !== null,
        )
        .toSorted(
            (first, second) =>
                Date.parse(second.timestamp) -
                Date.parse(first.timestamp),
        )
        .slice(0, limit);
}
