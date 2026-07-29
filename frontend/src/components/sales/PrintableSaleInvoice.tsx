import type { Customer } from "../../types/customer";
import type {
    SaleInvoice,
    SaleInvoiceItem,
} from "../../types/sale";
import {
    formatSaleMoney,
    getPrintableCustomer,
    getPrintableItemRows,
    getRemainingPresentation,
} from "../../utils/salePresentation";

type PrintableSaleInvoiceProps = {
    invoice: SaleInvoice;
    items: readonly SaleInvoiceItem[];
    customers: readonly Customer[];
};

export default function PrintableSaleInvoice({
    invoice,
    items,
    customers,
}: PrintableSaleInvoiceProps) {
    const customer = getPrintableCustomer(invoice, customers);
    const rows = getPrintableItemRows(items);
    const remaining = getRemainingPresentation(
        invoice.remainingAmount,
        invoice.currency,
    );

    return (
        <article
            className="printable-sale-invoice"
            dir="rtl"
            aria-labelledby="print-invoice-title"
        >
            <header className="print-invoice-header">
                <div>
                    <h1 id="print-invoice-title">
                        معرض البراء للسيراميك
                    </h1>
                    <p className="print-invoice-kind">فاتورة بيع</p>
                </div>
                <div className="print-invoice-number">
                    <span>رقم الفاتورة</span>
                    <strong dir="ltr">{invoice.invoiceNumber}</strong>
                </div>
            </header>

            <section className="print-customer-grid">
                <PrintField
                    label="تاريخ الفاتورة"
                    value={new Date(
                        invoice.createdAt,
                    ).toLocaleDateString("ar-IQ", {
                        dateStyle: "long",
                    })}
                />
                <PrintField
                    label="العميل"
                    value={customer.name}
                />
                {customer.phone && (
                    <PrintField
                        label="الهاتف"
                        value={customer.phone}
                    />
                )}
                {customer.address && (
                    <PrintField
                        label="العنوان"
                        value={customer.address}
                    />
                )}
                <PrintField
                    label="العملة"
                    value={invoice.currency}
                />
            </section>

            <table className="print-items-table">
                <thead>
                    <tr>
                        <th scope="col">التسلسل</th>
                        <th scope="col">الكود</th>
                        <th scope="col">المنتج</th>
                        <th scope="col">الوحدة</th>
                        <th scope="col">الكمية</th>
                        <th scope="col">سعر الوحدة</th>
                        <th scope="col">الإجمالي</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => (
                        <tr key={`${row.sequence}-${row.code}`}>
                            <td>{row.sequence}</td>
                            <td dir="ltr">{row.code}</td>
                            <td>{row.name}</td>
                            <td>{row.unit}</td>
                            <td>
                                {row.quantity.toLocaleString("ar-IQ")}
                            </td>
                            <td>
                                {formatSaleMoney(
                                    row.unitPrice,
                                    invoice.currency,
                                )}
                            </td>
                            <td>
                                {formatSaleMoney(
                                    row.total,
                                    invoice.currency,
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <section className="print-summary">
                <PrintAmount
                    label="المجموع الفرعي"
                    value={formatSaleMoney(
                        invoice.subtotal,
                        invoice.currency,
                    )}
                />
                <PrintAmount
                    label="الخصم"
                    value={formatSaleMoney(
                        invoice.discount,
                        invoice.currency,
                    )}
                />
                <PrintAmount
                    label="الإجمالي النهائي"
                    value={formatSaleMoney(
                        invoice.total,
                        invoice.currency,
                    )}
                    strong
                />
                <PrintAmount
                    label="المدفوع"
                    value={formatSaleMoney(
                        invoice.paidAmount,
                        invoice.currency,
                    )}
                />
                <PrintAmount
                    label={remaining.label}
                    value={remaining.value}
                    strong
                />
            </section>

            <section className="print-notes">
                <h2>الملاحظات</h2>
                <p>{invoice.note || "لا توجد ملاحظات."}</p>
            </section>

            <section className="print-signatures">
                <div>
                    <span>توقيع البائع</span>
                    <div />
                </div>
                <div>
                    <span>توقيع العميل</span>
                    <div />
                </div>
            </section>

            <footer>
                شكرًا لتعاملكم مع معرض البراء للسيراميك
            </footer>
        </article>
    );
}

function PrintField({
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

function PrintAmount({
    label,
    value,
    strong = false,
}: {
    label: string;
    value: string;
    strong?: boolean;
}) {
    return (
        <div className={strong ? "print-amount-strong" : ""}>
            <span>{label}</span>
            <span>{value}</span>
        </div>
    );
}
