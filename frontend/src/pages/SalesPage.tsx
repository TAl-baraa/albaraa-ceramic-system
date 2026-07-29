import type { ReactNode } from "react";
import { useState } from "react";
import {
    CircleCheckBig,
    Eye,
    FileText,
    Pencil,
    Plus,
    Search,
    Trash2,
    WalletCards,
    X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useSales } from "../context/SalesContext";
import type { Currency } from "../types/customer";
import type {
    SaleInvoice,
    SaleInvoiceStatus,
} from "../types/sale";

const statusLabels: Record<SaleInvoiceStatus, string> = {
    draft: "مسودة",
    completed: "مكتملة",
    cancelled: "ملغاة",
};

const statusClasses: Record<SaleInvoiceStatus, string> = {
    draft: "bg-amber-50 text-amber-700",
    completed: "bg-emerald-50 text-emerald-700",
    cancelled: "bg-slate-100 text-slate-600",
};

type StatusFilter = "all" | SaleInvoiceStatus;

function formatMoney(amount: number, currency: Currency) {
    if (currency === "USD") {
        return `USD ${amount.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })}`;
    }

    return `${amount.toLocaleString("ar-IQ", {
        maximumFractionDigits: 0,
    })} د.ع`;
}

function SalesPage() {
    const navigate = useNavigate();
    const { invoices, deleteDraftInvoice } = useSales();
    const [selectedCurrency, setSelectedCurrency] =
        useState<Currency>("IQD");
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] =
        useState<StatusFilter>("all");
    const [invoiceToDelete, setInvoiceToDelete] =
        useState<SaleInvoice | null>(null);
    const [actionError, setActionError] = useState("");

    const currencyInvoices = invoices.filter(
        (invoice) => invoice.currency === selectedCurrency,
    );
    const completedInvoices = currencyInvoices.filter(
        (invoice) => invoice.status === "completed",
    );
    const totalCompletedSales = completedInvoices.reduce(
        (total, invoice) => total + invoice.total,
        0,
    );
    const totalRemaining = completedInvoices.reduce(
        (total, invoice) => total + invoice.remainingAmount,
        0,
    );
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const filteredInvoices = currencyInvoices
        .filter(
            (invoice) =>
                statusFilter === "all" ||
                invoice.status === statusFilter,
        )
        .filter(
            (invoice) =>
                invoice.invoiceNumber
                    .toLowerCase()
                    .includes(normalizedSearch) ||
                invoice.customerNameSnapshot
                    .toLowerCase()
                    .includes(normalizedSearch),
        )
        .toSorted(
            (first, second) =>
                Date.parse(second.createdAt) -
                    Date.parse(first.createdAt) ||
                second.id - first.id,
        );

    function confirmDraftDeletion() {
        if (!invoiceToDelete) {
            return;
        }

        const result = deleteDraftInvoice(invoiceToDelete.id);

        if (!result.success) {
            setActionError(result.error);
        }

        setInvoiceToDelete(null);
    }

    return (
        <section>
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h3 className="text-2xl font-bold">المبيعات</h3>
                    <p className="mt-1 text-sm text-slate-500">
                        إدارة فواتير البيع ومتابعة المبالغ والمدفوعات.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => navigate("/sales/new")}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
                >
                    <Plus size={18} />
                    فاتورة بيع جديدة
                </button>
            </div>

            <div className="mb-5">
                <CurrencyToggle
                    value={selectedCurrency}
                    onChange={setSelectedCurrency}
                />
            </div>

            <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <SummaryCard
                    label="إجمالي الفواتير"
                    value={currencyInvoices.length.toLocaleString(
                        "ar-IQ",
                    )}
                    icon={<FileText size={22} />}
                    iconClassName="bg-slate-100 text-slate-700"
                />
                <SummaryCard
                    label="الفواتير المكتملة"
                    value={completedInvoices.length.toLocaleString(
                        "ar-IQ",
                    )}
                    icon={<CircleCheckBig size={22} />}
                    iconClassName="bg-emerald-50 text-emerald-700"
                />
                <SummaryCard
                    label="إجمالي المبيعات المكتملة"
                    value={formatMoney(
                        totalCompletedSales,
                        selectedCurrency,
                    )}
                    icon={<WalletCards size={22} />}
                    iconClassName="bg-blue-50 text-blue-700"
                />
                <SummaryCard
                    label="إجمالي المبالغ المتبقية"
                    value={formatMoney(
                        totalRemaining,
                        selectedCurrency,
                    )}
                    icon={<WalletCards size={22} />}
                    iconClassName="bg-red-50 text-red-700"
                />
            </div>

            {actionError && (
                <div className="mb-5 flex items-center justify-between gap-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                    <span>{actionError}</span>
                    <button
                        type="button"
                        onClick={() => setActionError("")}
                        aria-label="إغلاق الرسالة"
                    >
                        <X size={18} />
                    </button>
                </div>
            )}

            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                    <div className="relative w-full max-w-md">
                        <Search
                            size={19}
                            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                        />
                        <input
                            type="search"
                            value={searchTerm}
                            onChange={(event) =>
                                setSearchTerm(event.target.value)
                            }
                            placeholder="ابحث برقم الفاتورة أو اسم العميل"
                            className="w-full rounded-xl border border-slate-200 py-3 pr-10 pl-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                        />
                    </div>
                    <select
                        value={statusFilter}
                        onChange={(event) =>
                            setStatusFilter(
                                event.target.value as StatusFilter,
                            )
                        }
                        aria-label="تصفية حسب حالة الفاتورة"
                        className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
                    >
                        <option value="all">كل الحالات</option>
                        <option value="draft">مسودة</option>
                        <option value="completed">مكتملة</option>
                        <option value="cancelled">ملغاة</option>
                    </select>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full min-w-[1250px] text-right text-sm">
                        <thead className="bg-slate-50 text-slate-600">
                            <tr>
                                <th className="px-4 py-4">رقم الفاتورة</th>
                                <th className="px-4 py-4">التاريخ</th>
                                <th className="px-4 py-4">العميل</th>
                                <th className="px-4 py-4">الإجمالي</th>
                                <th className="px-4 py-4">المدفوع</th>
                                <th className="px-4 py-4">المتبقي</th>
                                <th className="px-4 py-4">العملة</th>
                                <th className="px-4 py-4">الحالة</th>
                                <th className="px-4 py-4">الإجراءات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredInvoices.map((invoice) => (
                                <tr
                                    key={invoice.id}
                                    className="transition hover:bg-slate-50"
                                >
                                    <td className="px-4 py-4 font-semibold" dir="ltr">
                                        {invoice.invoiceNumber}
                                    </td>
                                    <td className="whitespace-nowrap px-4 py-4 text-slate-600">
                                        {new Date(
                                            invoice.createdAt,
                                        ).toLocaleDateString("ar-IQ")}
                                    </td>
                                    <td className="px-4 py-4">
                                        {invoice.customerNameSnapshot ||
                                            "عميل نقدي"}
                                    </td>
                                    <MoneyCell
                                        amount={invoice.total}
                                        currency={invoice.currency}
                                    />
                                    <MoneyCell
                                        amount={invoice.paidAmount}
                                        currency={invoice.currency}
                                    />
                                    <MoneyCell
                                        amount={invoice.remainingAmount}
                                        currency={invoice.currency}
                                    />
                                    <td className="px-4 py-4">
                                        {invoice.currency}
                                    </td>
                                    <td className="px-4 py-4">
                                        <span
                                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClasses[invoice.status]}`}
                                        >
                                            {statusLabels[invoice.status]}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="flex gap-1">
                                            <ActionButton
                                                label="عرض الفاتورة"
                                                onClick={() =>
                                                    navigate(
                                                        `/sales/${invoice.id}`,
                                                    )
                                                }
                                            >
                                                <Eye size={18} />
                                            </ActionButton>
                                            {invoice.status === "draft" && (
                                                <>
                                                    <ActionButton
                                                        label="تعديل الفاتورة"
                                                        onClick={() =>
                                                            navigate(
                                                                `/sales/${invoice.id}?edit=1`,
                                                            )
                                                        }
                                                        className="text-blue-600 hover:bg-blue-50"
                                                    >
                                                        <Pencil size={18} />
                                                    </ActionButton>
                                                    <ActionButton
                                                        label="حذف المسودة"
                                                        onClick={() =>
                                                            setInvoiceToDelete(
                                                                invoice,
                                                            )
                                                        }
                                                        className="text-red-600 hover:bg-red-50"
                                                    >
                                                        <Trash2 size={18} />
                                                    </ActionButton>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {filteredInvoices.length === 0 && (
                    <div className="px-5 py-16 text-center">
                        <p className="font-semibold">
                            لا توجد فواتير مطابقة
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                            غيّر البحث أو حالة الفاتورة لعرض نتائج أخرى.
                        </p>
                    </div>
                )}
            </div>

            {invoiceToDelete && (
                <DeleteDraftDialog
                    invoice={invoiceToDelete}
                    onClose={() => setInvoiceToDelete(null)}
                    onConfirm={confirmDraftDeletion}
                />
            )}
        </section>
    );
}

function CurrencyToggle({
    value,
    onChange,
}: {
    value: Currency;
    onChange: (currency: Currency) => void;
}) {
    return (
        <div
            role="group"
            aria-label="عملة عرض فواتير المبيعات"
            className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1"
        >
            {(
                [
                    ["IQD", "الدينار العراقي"],
                    ["USD", "الدولار الأمريكي"],
                ] as const
            ).map(([currency, label]) => (
                <button
                    key={currency}
                    type="button"
                    onClick={() => onChange(currency)}
                    aria-pressed={value === currency}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                        value === currency
                            ? "bg-white text-slate-900 shadow-sm"
                            : "text-slate-500 hover:text-slate-800"
                    }`}
                >
                    {label}
                </button>
            ))}
        </div>
    );
}

function SummaryCard({
    label,
    value,
    icon,
    iconClassName,
}: {
    label: string;
    value: string;
    icon: ReactNode;
    iconClassName: string;
}) {
    return (
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <p className="text-sm text-slate-500">{label}</p>
                    <p className="mt-2 text-2xl font-bold">{value}</p>
                </div>
                <div className={`rounded-xl p-3 ${iconClassName}`}>
                    {icon}
                </div>
            </div>
        </article>
    );
}

function MoneyCell({
    amount,
    currency,
}: {
    amount: number;
    currency: Currency;
}) {
    return (
        <td className="whitespace-nowrap px-4 py-4 font-semibold">
            {formatMoney(amount, currency)}
        </td>
    );
}

function ActionButton({
    label,
    onClick,
    children,
    className = "text-slate-600 hover:bg-slate-100",
}: {
    label: string;
    onClick: () => void;
    children: ReactNode;
    className?: string;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={label}
            title={label}
            className={`rounded-lg p-2 transition ${className}`}
        >
            {children}
        </button>
    );
}

function DeleteDraftDialog({
    invoice,
    onClose,
    onConfirm,
}: {
    invoice: SaleInvoice;
    onClose: () => void;
    onConfirm: () => void;
}) {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <button
                type="button"
                onClick={onClose}
                aria-label="إغلاق نافذة التأكيد"
                className="fixed inset-0 bg-slate-950/60"
            />
            <div
                role="dialog"
                aria-modal="true"
                className="relative z-[101] w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
            >
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h4 className="text-lg font-bold">
                            حذف مسودة الفاتورة
                        </h4>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                            هل تريد حذف الفاتورة{" "}
                            <strong dir="ltr">
                                {invoice.invoiceNumber}
                            </strong>
                            ؟ لا يمكن التراجع عن هذا الإجراء.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="إغلاق"
                        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                    >
                        <X size={19} />
                    </button>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold hover:bg-slate-100"
                    >
                        تراجع
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
                    >
                        حذف المسودة
                    </button>
                </div>
            </div>
        </div>
    );
}

export default SalesPage;
