import type {
    Currency,
    Customer,
    CustomerBalance,
    CustomerTransaction,
} from "../types/customer";
import type {
    SaleInvoice,
    SaleInvoiceItem,
} from "../types/sale";
import {
    applyCustomerTransaction,
} from "./customerBalance.ts";
import { formatCurrency } from "./formatters.ts";

export type CustomerStatementEntry = {
    key: string;
    timestamp: string;
    type: "opening" | "invoice" | "transaction";
    description: string;
    note: string;
    debit: number;
    credit: number;
    effect: number;
    runningBalance: number;
    sourceReference: string;
    status: "active" | "voided";
    statusLabel: string;
    voidReason: string;
    invoice: SaleInvoice | null;
    invoiceItems: SaleInvoiceItem[];
    invoiceDetailsMissing: boolean;
};

export type CustomerStatement = {
    customer: Customer;
    currency: Currency;
    openingBalance: number;
    entries: CustomerStatementEntry[];
    totalSales: number;
    totalPayments: number;
    finalBalance: number;
};

type StatementOptions = {
    customer: Customer;
    currency: Currency;
    invoices: readonly SaleInvoice[];
    invoiceItems: readonly SaleInvoiceItem[];
    transactions: readonly CustomerTransaction[];
    startDate?: Date;
    endDate?: Date;
    showVoided?: boolean;
};

const TRANSACTION_LABELS: Record<
    CustomerTransaction["type"],
    string
> = {
    debt: "دين على العميل",
    credit: "رصيد للعميل",
    payment_received: "دفعة مستلمة",
    payment_paid: "دفعة مدفوعة",
    adjustment: "تصحيح حساب",
};

function validTimestamp(value: string | null | undefined) {
    const timestamp = value ? Date.parse(value) : Number.NaN;
    return Number.isFinite(timestamp) ? timestamp : 0;
}

function matchesLinkedInvoice(
    transaction: CustomerTransaction,
    invoice: SaleInvoice,
) {
    if (transaction.sourceType !== "sale_invoice") return false;
    if (transaction.sourceId !== null) {
        return transaction.sourceId === invoice.id;
    }
    return (
        transaction.sourceReference !== "" &&
        transaction.sourceReference === invoice.invoiceNumber
    );
}

function invoiceTimestamp(invoice: SaleInvoice) {
    return invoice.completedAt ?? invoice.createdAt;
}

type Candidate =
    | {
          kind: "invoice";
          timestamp: string;
          order: number;
          invoice: SaleInvoice;
          linkedTransactions: CustomerTransaction[];
      }
    | {
          kind: "transaction";
          timestamp: string;
          order: number;
          transaction: CustomerTransaction;
          missingInvoice: boolean;
      };

function inRange(timestamp: number, start?: Date, end?: Date) {
    return (
        (!start || timestamp >= start.getTime()) &&
        (!end || timestamp <= end.getTime())
    );
}

function emptyBalance(currency: Currency, amount: number): CustomerBalance {
    return currency === "IQD"
        ? { IQD: amount, USD: 0 }
        : { IQD: 0, USD: amount };
}

export function buildCustomerStatement({
    customer,
    currency,
    invoices,
    invoiceItems,
    transactions,
    startDate,
    endDate,
    showVoided = false,
}: StatementOptions): CustomerStatement {
    const customerInvoices = invoices.filter(
        (invoice) =>
            invoice.customerId === customer.id &&
            invoice.currency === currency &&
            invoice.status !== "draft" &&
            (showVoided || invoice.status !== "cancelled"),
    );
    const linkedTransactions = new Set<number>();

    customerInvoices.forEach((invoice) => {
        transactions.forEach((transaction) => {
            if (matchesLinkedInvoice(transaction, invoice)) {
                linkedTransactions.add(transaction.id);
            }
        });
    });

    const invoiceCandidates: Candidate[] = customerInvoices.map(
        (invoice) => ({
            kind: "invoice",
            timestamp: invoiceTimestamp(invoice),
            order: invoice.id,
            invoice,
            linkedTransactions: transactions.filter((transaction) =>
                matchesLinkedInvoice(transaction, invoice),
            ),
        }),
    );
    const transactionCandidates: Candidate[] = transactions
        .filter(
            (transaction) =>
                transaction.customerId === customer.id &&
                transaction.currency === currency &&
                !linkedTransactions.has(transaction.id) &&
                (showVoided || transaction.status === "active"),
        )
        .map((transaction) => ({
            kind: "transaction",
            timestamp: transaction.createdAt,
            order: transaction.id,
            transaction,
            missingInvoice:
                transaction.sourceType === "sale_invoice",
        }));
    const candidates = [
        ...invoiceCandidates,
        ...transactionCandidates,
    ].toSorted(
        (first, second) =>
            validTimestamp(first.timestamp) -
                validTimestamp(second.timestamp) ||
            first.order - second.order ||
            (first.kind === "invoice" ? -1 : 1),
    );

    let runningBalance = 0;
    let openingBalance = 0;
    let totalSales = 0;
    let totalPayments = 0;
    const entries: CustomerStatementEntry[] = [];

    candidates.forEach((candidate) => {
        const timestamp = validTimestamp(candidate.timestamp);
        let effect = 0;
        let isActive = true;

        if (candidate.kind === "invoice") {
            isActive = candidate.invoice.status === "completed";
            const activeLinkedTransaction =
                candidate.linkedTransactions.find(
                    (transaction) =>
                        transaction.status === "active",
                );
            if (isActive && activeLinkedTransaction) {
                const before = emptyBalance(currency, runningBalance);
                const after = applyCustomerTransaction(
                    before,
                    activeLinkedTransaction,
                );
                effect = after[currency] - runningBalance;
            } else if (
                isActive &&
                candidate.linkedTransactions.length === 0
            ) {
                effect = candidate.invoice.remainingAmount;
            }
        } else {
            isActive = candidate.transaction.status === "active";
            if (isActive) {
                const before = emptyBalance(currency, runningBalance);
                const after = applyCustomerTransaction(
                    before,
                    candidate.transaction,
                );
                effect = after[currency] - runningBalance;
            }
        }

        if (startDate && timestamp < startDate.getTime()) {
            if (isActive) {
                runningBalance += effect;
            }
            openingBalance = runningBalance;
            return;
        }

        if (!inRange(timestamp, startDate, endDate)) return;

        if (candidate.kind === "invoice") {
            const invoice = candidate.invoice;
            if (isActive) {
                runningBalance += effect;
                totalSales += invoice.total;
                totalPayments += invoice.paidAmount;
            }
            entries.push({
                key: `invoice-${invoice.id}`,
                timestamp: candidate.timestamp,
                type: "invoice",
                description: `فاتورة بيع ${invoice.invoiceNumber}`,
                note: invoice.note,
                debit: Math.max(effect, 0),
                credit: Math.abs(Math.min(effect, 0)),
                effect,
                runningBalance,
                sourceReference: invoice.invoiceNumber,
                status: isActive ? "active" : "voided",
                statusLabel:
                    invoice.status === "cancelled"
                        ? "ملغاة"
                        : "مكتملة",
                voidReason: invoice.cancellationReason,
                invoice,
                invoiceItems: invoiceItems.filter(
                    (item) => item.invoiceId === invoice.id,
                ),
                invoiceDetailsMissing: false,
            });
            return;
        }

        const transaction = candidate.transaction;
        if (isActive) {
            runningBalance += effect;
            if (transaction.type === "payment_received") {
                totalPayments += transaction.amount;
            }
        }
        entries.push({
            key: `transaction-${transaction.id}`,
            timestamp: transaction.createdAt,
            type: "transaction",
            description: TRANSACTION_LABELS[transaction.type],
            note: transaction.note,
            debit: isActive ? Math.max(effect, 0) : 0,
            credit: isActive
                ? Math.abs(Math.min(effect, 0))
                : 0,
            effect: isActive ? effect : 0,
            runningBalance,
            sourceReference: transaction.sourceReference,
            status: transaction.status,
            statusLabel:
                transaction.status === "voided"
                    ? "ملغاة"
                    : transaction.createdByCorrection
                      ? "حركة مصححة"
                      : "",
            voidReason: transaction.voidReason,
            invoice: null,
            invoiceItems: [],
            invoiceDetailsMissing: candidate.missingInvoice,
        });
    });

    return {
        customer,
        currency,
        openingBalance,
        entries,
        totalSales,
        totalPayments,
        finalBalance: runningBalance,
    };
}

export function getStatementBalanceLabel(
    balance: number,
    currency: Currency,
) {
    if (balance > 0) {
        return `صافي الحساب: لنا على العميل ${formatCurrency(balance, currency)}`;
    }
    if (balance < 0) {
        return `صافي الحساب: للعميل علينا ${formatCurrency(Math.abs(balance), currency)}`;
    }
    return "صافي الحساب: مسدد بالكامل";
}
