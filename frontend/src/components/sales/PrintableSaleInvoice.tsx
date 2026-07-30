import { MessageCircle, Phone } from "lucide-react";
import type { ReactNode } from "react";

import type { Customer } from "../../types/customer";
import type {
    SaleInvoice,
    SaleInvoiceItem,
} from "../../types/sale";
import {
    formatSaleMoney,
    getPrintableCustomer,
    getPrintableInvoiceStatusLabel,
    getPrintableItemRows,
    getRemainingPresentation,
} from "../../utils/salePresentation";
import {
    formatDate,
    formatQuantity,
    normalizeWesternDigits,
} from "../../utils/formatters";

const STORE_ACTIVITY =
    "سيراميك - بورسلين - حمام - كير - أبو جرّة";
const STORE_PHONE = "07714416761";
const STORE_WHATSAPP = "07815290761";

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
    const cancelledLabel = getPrintableInvoiceStatusLabel(
        invoice.status,
    );
    const isCancelled = cancelledLabel !== null;

    return (
        <article
            className="printable-sale-invoice"
            dir="rtl"
            aria-labelledby="print-invoice-title"
        >
            <div className="print-document-frame">
                <div className="print-gold-rule" />

                <header className="print-brand-header">
                    <section className="print-store-identity">
                        <div className="print-store-mark" aria-hidden="true">
                            ب
                        </div>
                        <div>
                            <h1 id="print-invoice-title">
                                معرض البراء للسيراميك
                            </h1>
                            <p className="print-store-subtitle">
                                للسيراميك
                            </p>
                            <p className="print-store-activity">
                                {STORE_ACTIVITY}
                            </p>
                        </div>
                    </section>

                    <section
                        className="print-store-contacts"
                        aria-label="معلومات الاتصال"
                    >
                        <ContactLine
                            icon={<Phone size={16} strokeWidth={1.8} />}
                            label="هاتف"
                            value={STORE_PHONE}
                        />
                        <ContactLine
                            icon={
                                <MessageCircle
                                    size={16}
                                    strokeWidth={1.8}
                                />
                            }
                            label="واتساب"
                            value={STORE_WHATSAPP}
                        />
                    </section>
                </header>

                <div className="print-invoice-title-band">
                    <span>فاتورة بيع</span>
                    {isCancelled && (
                        <strong className="print-cancelled-stamp">
                            {cancelledLabel}
                        </strong>
                    )}
                </div>

                <section className="print-invoice-identity">
                    <div className="print-customer-information">
                        <PrintField
                            label="اسم العميل"
                            value={customer.name}
                        />
                        <PrintField
                            label="رقم الهاتف"
                            value={customer.phone ?? "—"}
                        />
                        <PrintField
                            label="العنوان"
                            value={customer.address ?? "—"}
                        />
                        <PrintField
                            label="التاريخ"
                            value={formatDate(invoice.createdAt, {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                            })}
                        />
                        <PrintField
                            label="العملة"
                            value={invoice.currency}
                        />
                    </div>

                    <div className="print-invoice-reference">
                        <span>رقم الفاتورة</span>
                        <strong dir="ltr">
                            {normalizeWesternDigits(
                                invoice.invoiceNumber,
                            )}
                        </strong>
                        {isCancelled && (
                            <span className="print-reference-status">
                                الحالة: {cancelledLabel}
                            </span>
                        )}
                    </div>
                </section>

                {isCancelled && (
                    <section className="print-cancellation-panel">
                        <strong>{cancelledLabel}</strong>
                        <span>
                            تاريخ الإلغاء:{" "}
                            {invoice.cancelledAt
                                ? formatDate(invoice.cancelledAt, {
                                      day: "2-digit",
                                      month: "2-digit",
                                      year: "numeric",
                                  })
                                : "—"}
                        </span>
                        <span>
                            سبب الإلغاء:{" "}
                            {invoice.cancellationReason || "—"}
                        </span>
                    </section>
                )}

                <table className="print-items-table">
                    <thead>
                        <tr>
                            <th scope="col">المادة</th>
                            <th scope="col">الكمية</th>
                            <th scope="col">الوحدة</th>
                            <th scope="col">سعر الوحدة</th>
                            <th scope="col">الإجمالي</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => (
                            <tr key={`${row.sequence}-${row.code}`}>
                                <td className="print-product-cell">
                                    <strong>{row.name}</strong>
                                    <small dir="ltr">
                                        code:{" "}
                                        {normalizeWesternDigits(row.code)}
                                    </small>
                                </td>
                                <td>{formatQuantity(row.quantity)}</td>
                                <td>{row.unit}</td>
                                <td>
                                    {formatSaleMoney(
                                        row.unitPrice,
                                        invoice.currency,
                                    )}
                                </td>
                                <td className="print-line-total">
                                    {formatSaleMoney(
                                        row.total,
                                        invoice.currency,
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <section className="print-closing-grid">
                    <div className="print-notes-box">
                        <h2>ملاحظات</h2>
                        <p>{invoice.note || "\u00a0"}</p>
                    </div>

                    <div className="print-totals-box">
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
                    </div>
                </section>

                <section className="print-signatures">
                    <SignatureLine label="توقيع البائع" />
                    <SignatureLine label="توقيع العميل" />
                </section>

                <footer className="print-invoice-footer">
                    <p>الخطأ والسهو مرجوع للطرفين</p>
                    <p>
                        شكرًا لتعاملكم مع معرض البراء للسيراميك
                    </p>
                </footer>
            </div>
        </article>
    );
}

function ContactLine({
    icon,
    label,
    value,
}: {
    icon: ReactNode;
    label: string;
    value: string;
}) {
    return (
        <div>
            <span className="print-contact-icon">{icon}</span>
            <span>{label}</span>
            <strong dir="ltr">{value}</strong>
        </div>
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
            <strong>{value}</strong>
        </div>
    );
}

function SignatureLine({ label }: { label: string }) {
    return (
        <div>
            <span>{label}</span>
            <div />
        </div>
    );
}
