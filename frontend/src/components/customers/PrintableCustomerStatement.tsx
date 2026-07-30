import type { CustomerStatement } from "../../utils/customerStatement";
import { getStatementBalanceLabel } from "../../utils/customerStatement";
import {
    formatCurrency,
    formatDate,
    formatDateTime,
    formatPhoneNumber,
    formatQuantity,
    normalizeWesternDigits,
} from "../../utils/formatters";

type PrintableCustomerStatementProps = {
    statement: CustomerStatement;
    startDate: Date | undefined;
    endDate: Date;
    generatedAt: Date;
};

export default function PrintableCustomerStatement({
    statement,
    startDate,
    endDate,
    generatedAt,
}: PrintableCustomerStatementProps) {
    return (
        <article
            className="printable-customer-statement"
            dir="rtl"
            aria-labelledby="print-statement-title"
        >
            <div className="statement-document-frame">
                <header className="statement-print-header">
                    <div>
                        <p>معرض البراء للسيراميك</p>
                        <h1 id="print-statement-title">
                            كشف حساب عميل
                        </h1>
                    </div>
                    <div className="statement-print-meta">
                        <span>تاريخ الإصدار</span>
                        <strong>{formatDateTime(generatedAt)}</strong>
                    </div>
                </header>

                <section className="statement-customer-grid">
                    <StatementField
                        label="اسم العميل"
                        value={statement.customer.name}
                    />
                    <StatementField
                        label="رقم الهاتف"
                        value={
                            statement.customer.phone
                                ? formatPhoneNumber(
                                      statement.customer.phone,
                                  )
                                : "—"
                        }
                    />
                    <StatementField
                        label="العنوان"
                        value={statement.customer.address || "—"}
                    />
                    <StatementField
                        label="العملة"
                        value={statement.currency}
                    />
                    <StatementField
                        label="الفترة"
                        value={`${startDate ? formatDate(startDate) : "جميع الحركات"} — ${formatDate(endDate)}`}
                    />
                </section>

                <section className="statement-print-summary">
                    <SummaryBox
                        label="الرصيد الافتتاحي"
                        value={formatCurrency(
                            statement.openingBalance,
                            statement.currency,
                        )}
                    />
                    <SummaryBox
                        label="إجمالي المبيعات"
                        value={formatCurrency(
                            statement.totalSales,
                            statement.currency,
                        )}
                    />
                    <SummaryBox
                        label="إجمالي المدفوعات"
                        value={formatCurrency(
                            statement.totalPayments,
                            statement.currency,
                        )}
                    />
                    <SummaryBox
                        label="الرصيد النهائي"
                        value={formatCurrency(
                            statement.finalBalance,
                            statement.currency,
                        )}
                    />
                </section>

                <table className="statement-ledger-table">
                    <thead>
                        <tr>
                            <th scope="col">التاريخ</th>
                            <th scope="col">البيان</th>
                            <th scope="col">لنا عليه</th>
                            <th scope="col">له علينا</th>
                            <th scope="col">الرصيد</th>
                        </tr>
                    </thead>
                    <tbody>
                        {startDate && (
                            <tr className="statement-opening-row">
                                <td>{formatDate(startDate)}</td>
                                <td>الرصيد الافتتاحي</td>
                                <td>—</td>
                                <td>—</td>
                                <td>
                                    {formatCurrency(
                                        statement.openingBalance,
                                        statement.currency,
                                    )}
                                </td>
                            </tr>
                        )}
                        {statement.entries.map((entry) => (
                            <StatementEntryRows
                                key={entry.key}
                                entry={entry}
                                currency={statement.currency}
                            />
                        ))}
                    </tbody>
                </table>

                <div className="statement-final-result">
                    {getStatementBalanceLabel(
                        statement.finalBalance,
                        statement.currency,
                    )}
                </div>

                <footer className="statement-print-footer">
                    <span>توقيع المحاسب</span>
                    <p>
                        شكرًا لتعاملكم مع معرض البراء للسيراميك
                    </p>
                </footer>
            </div>
        </article>
    );
}

function StatementEntryRows({
    entry,
    currency,
}: {
    entry: CustomerStatement["entries"][number];
    currency: CustomerStatement["currency"];
}) {
    const mutedClass =
        entry.status === "voided" ? "statement-voided-entry" : "";

    return (
        <>
            <tr className={mutedClass}>
                <td>{formatDate(entry.timestamp)}</td>
                <td>
                    <strong>{entry.description}</strong>
                    {entry.statusLabel && (
                        <span className="statement-status-label">
                            {entry.statusLabel}
                        </span>
                    )}
                    {entry.sourceReference && (
                        <small dir="ltr">
                            {normalizeWesternDigits(
                                entry.sourceReference,
                            )}
                        </small>
                    )}
                    {entry.note && <small>{entry.note}</small>}
                    {entry.voidReason && (
                        <small>السبب: {entry.voidReason}</small>
                    )}
                    {entry.invoiceDetailsMissing && (
                        <small>تعذر تحميل تفاصيل الفاتورة</small>
                    )}
                </td>
                <td>
                    {entry.debit > 0
                        ? formatCurrency(entry.debit, currency)
                        : "—"}
                </td>
                <td>
                    {entry.credit > 0
                        ? formatCurrency(entry.credit, currency)
                        : "—"}
                </td>
                <td>
                    {formatCurrency(entry.runningBalance, currency)}
                </td>
            </tr>
            {entry.invoice && (
                <tr className={`statement-invoice-detail ${mutedClass}`}>
                    <td colSpan={5}>
                        <div className="statement-invoice-amounts">
                            <span>
                                إجمالي الفاتورة:{" "}
                                {formatCurrency(
                                    entry.invoice.total,
                                    currency,
                                )}
                            </span>
                            <span>
                                المدفوع:{" "}
                                {formatCurrency(
                                    entry.invoice.paidAmount,
                                    currency,
                                )}
                            </span>
                            <span>
                                المسجل على الحساب:{" "}
                                {formatCurrency(
                                    Math.abs(entry.effect),
                                    currency,
                                )}
                            </span>
                        </div>
                        <p className="statement-materials-title">
                            تفاصيل المواد
                        </p>
                        {entry.invoiceItems.length === 0 ? (
                            <p className="statement-missing-details">
                                تعذر تحميل تفاصيل الفاتورة
                            </p>
                        ) : (
                            <table className="statement-products-table">
                                <thead>
                                    <tr>
                                        <th>الكود</th>
                                        <th>المادة</th>
                                        <th>الوحدة</th>
                                        <th>الكمية</th>
                                        <th>سعر الوحدة</th>
                                        <th>الإجمالي</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {entry.invoiceItems.map((item) => (
                                        <tr key={item.id}>
                                            <td dir="ltr">
                                                {normalizeWesternDigits(
                                                    item.productCodeSnapshot,
                                                )}
                                            </td>
                                            <td>
                                                {
                                                    item.productNameSnapshot
                                                }
                                            </td>
                                            <td>{item.unit}</td>
                                            <td>
                                                {formatQuantity(
                                                    item.quantity,
                                                )}
                                            </td>
                                            <td>
                                                {formatCurrency(
                                                    item.unitPrice,
                                                    currency,
                                                )}
                                            </td>
                                            <td>
                                                {formatCurrency(
                                                    item.total,
                                                    currency,
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </td>
                </tr>
            )}
        </>
    );
}

function StatementField({
    label,
    value,
}: {
    label: string;
    value: string;
}) {
    return (
        <div>
            <span>{label}</span>
            <strong>{value}</strong>
        </div>
    );
}

function SummaryBox({
    label,
    value,
}: {
    label: string;
    value: string;
}) {
    return (
        <div>
            <span>{label}</span>
            <strong>{value}</strong>
        </div>
    );
}
