import type {
    Currency,
    Customer,
} from "../types/customer";
import type {
    SaleInvoice,
    SaleInvoiceItem,
} from "../types/sale";

export function formatSaleMoney(
    amount: number,
    currency: Currency,
) {
    return currency === "USD"
        ? `USD ${amount.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
          })}`
        : `${amount.toLocaleString("ar-IQ", {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
          })} د.ع`;
}

export function getRemainingPresentation(
    remainingAmount: number,
    currency: Currency,
) {
    if (remainingAmount < 0) {
        return {
            label: "المبلغ الزائد للعميل",
            value: formatSaleMoney(
                Math.abs(remainingAmount),
                currency,
            ),
        };
    }

    if (remainingAmount === 0) {
        return {
            label: "مسدد بالكامل",
            value: formatSaleMoney(0, currency),
        };
    }

    return {
        label: "المتبقي",
        value: formatSaleMoney(remainingAmount, currency),
    };
}

export function getPrintableCustomer(
    invoice: Pick<
        SaleInvoice,
        "customerId" | "customerNameSnapshot"
    >,
    customers: readonly Customer[],
) {
    const currentCustomer =
        invoice.customerId === null
            ? undefined
            : customers.find(
                  (customer) =>
                      customer.id === invoice.customerId,
              );

    return {
        name:
            invoice.customerId === null
                ? "بيع نقدي"
                : invoice.customerNameSnapshot,
        phone: currentCustomer?.phone || null,
        address: currentCustomer?.address || null,
    };
}

export function getPrintableItemRows(
    items: readonly SaleInvoiceItem[],
) {
    return items.map((item, index) => ({
        sequence: index + 1,
        code: item.productCodeSnapshot,
        name: item.productNameSnapshot,
        unit: item.unit,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total,
    }));
}

export function getPaymentExplanation(
    invoice: Pick<
        SaleInvoice,
        "customerId" | "remainingAmount"
    >,
) {
    if (invoice.customerId === null) {
        return "بيع نقدي بدون حساب عميل.";
    }

    if (invoice.remainingAmount > 0) {
        return "تم تسجيل المبلغ المتبقي دينًا على العميل.";
    }

    if (invoice.remainingAmount < 0) {
        return "تم تسجيل المبلغ الزائد رصيدًا للعميل.";
    }

    return "الفاتورة مدفوعة بالكامل ولم تُسجل حركة دين.";
}

export function getSalesSummary(
    invoices: readonly SaleInvoice[],
    currency: Currency,
) {
    const currencyInvoices = invoices.filter(
        (invoice) => invoice.currency === currency,
    );
    const completedInvoices = currencyInvoices.filter(
        (invoice) => invoice.status === "completed",
    );

    return {
        invoiceCount: currencyInvoices.length,
        completedCount: completedInvoices.length,
        completedSales: completedInvoices.reduce(
            (total, invoice) => total + invoice.total,
            0,
        ),
        completedRemaining: completedInvoices.reduce(
            (total, invoice) =>
                total + invoice.remainingAmount,
            0,
        ),
    };
}
