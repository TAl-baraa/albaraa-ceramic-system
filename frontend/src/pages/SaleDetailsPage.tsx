import {
    ArrowRight,
    Check,
    CircleX,
    Pencil,
    Printer,
} from "lucide-react";
import { useState } from "react";
import {
    useNavigate,
    useParams,
    useSearchParams,
} from "react-router-dom";

import { useSales } from "../context/SalesContext";
import PrintableSaleInvoice from "../components/sales/PrintableSaleInvoice";
import { useCustomers } from "../context/CustomersContext";
import type {
    SaleInvoice,
    SaleInvoiceStatus,
} from "../types/sale";
import {
    formatDateTime,
    formatNumber,
    formatQuantity,
    normalizeWesternDigits,
} from "../utils/formatters";
import {
    formatSaleMoney,
    getPaymentExplanation,
    getRemainingPresentation,
} from "../utils/salePresentation";
import {
    FinalizeInvoiceDialog,
    SaleInvoiceEditor,
} from "./NewSalePage";

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

function SaleDetailsPage() {
    const navigate = useNavigate();
    const { invoiceId } = useParams();
    const [searchParams] = useSearchParams();
    const {
        getInvoiceById,
        getItemsByInvoiceId,
        completeDraftInvoice,
        cancelCompletedInvoice,
    } = useSales();
    const { customers } = useCustomers();
    const [showFinalizeConfirmation, setShowFinalizeConfirmation] =
        useState(false);
    const [completionError, setCompletionError] = useState("");
    const [cancellationError, setCancellationError] = useState("");
    const [showCancellationConfirmation, setShowCancellationConfirmation] =
        useState(false);
    const [printError, setPrintError] = useState("");
    const numericInvoiceId = Number(invoiceId);
    const invoice = Number.isFinite(numericInvoiceId)
        ? getInvoiceById(numericInvoiceId)
        : undefined;
    const items = invoice
        ? getItemsByInvoiceId(invoice.id)
        : [];

    if (searchParams.get("edit") === "1") {
        return (
            <SaleInvoiceEditor
                invoiceId={
                    Number.isFinite(numericInvoiceId)
                        ? numericInvoiceId
                        : Number.NaN
                }
            />
        );
    }

    function finalizeInvoice() {
        if (!invoice) {
            return;
        }

        const result = completeDraftInvoice(invoice.id);

        if (!result.success) {
            setCompletionError(result.error);
            setShowFinalizeConfirmation(false);
            return;
        }

        setShowFinalizeConfirmation(false);
        navigate(`/sales/${invoice.id}?completed=1`, {
            replace: true,
        });
    }

    function printInvoice() {
        const hasMalformedItem = items.some(
            (item) =>
                !item.productCodeSnapshot ||
                !item.productNameSnapshot ||
                !Number.isFinite(item.quantity) ||
                item.quantity <= 0 ||
                !Number.isFinite(item.unitPrice) ||
                item.unitPrice <= 0 ||
                !Number.isFinite(item.total),
        );

        if (items.length === 0 || hasMalformedItem) {
            setPrintError(
                "لا يمكن طباعة فاتورة دون منتجات صالحة.",
            );
            return;
        }

        setPrintError("");
        window.print();
    }

    function cancelInvoice(reason: string) {
        if (!invoice) {
            return;
        }

        const result = cancelCompletedInvoice(invoice.id, reason);

        if (!result.success) {
            setCancellationError(result.error);
            setShowCancellationConfirmation(false);
            return;
        }

        setCancellationError("");
        setShowCancellationConfirmation(false);
        navigate(`/sales/${invoice.id}?cancelled=1`, {
            replace: true,
        });
    }

    return (
        <section className="mx-auto max-w-6xl">
            <button
                type="button"
                onClick={() => navigate("/sales")}
                className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
            >
                <ArrowRight size={18} />
                العودة إلى المبيعات
            </button>

            {!invoice ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
                    <h3 className="text-xl font-bold">
                        الفاتورة غير موجودة
                    </h3>
                    <p className="mt-2 text-sm text-slate-500">
                        تعذر العثور على فاتورة البيع المطلوبة.
                    </p>
                </div>
            ) : (
                <div className="space-y-6">
                    {searchParams.get("completed") === "1" && (
                        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                            <Check size={18} />
                            تم اعتماد الفاتورة وتحديث المخزون والحساب
                            بنجاح.
                        </div>
                    )}
                    {searchParams.get("cancelled") === "1" && (
                        <div className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                            <CircleX size={18} />
                            تم إلغاء الفاتورة وعكس آثارها على المخزون
                            وحساب العميل.
                        </div>
                    )}
                    {completionError && (
                        <div className="whitespace-pre-line rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                            {completionError}
                        </div>
                    )}
                    {printError && (
                        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                            {printError}
                        </div>
                    )}
                    {cancellationError && (
                        <div className="whitespace-pre-line rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                            {cancellationError}
                        </div>
                    )}

                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="text-sm text-slate-500">
                                    فاتورة بيع
                                </p>
                                <h3 className="mt-1 text-2xl font-bold" dir="ltr">
                                    {normalizeWesternDigits(
                                        invoice.invoiceNumber,
                                    )}
                                </h3>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <span
                                    className={`rounded-full px-4 py-2 text-sm font-semibold ${statusClasses[invoice.status]}`}
                                >
                                    {statusLabels[invoice.status]}
                                </span>
                                {invoice.status === "draft" && (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                navigate(
                                                    `/sales/${invoice.id}?edit=1`,
                                                )
                                            }
                                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold hover:bg-slate-100"
                                        >
                                            <Pencil size={17} />
                                            تعديل المسودة
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setShowFinalizeConfirmation(
                                                    true,
                                                )
                                            }
                                            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
                                        >
                                            اعتماد الفاتورة
                                        </button>
                                    </>
                                )}
                                {(invoice.status === "completed" ||
                                    invoice.status === "cancelled") && (
                                    <button
                                        type="button"
                                        onClick={printInvoice}
                                        aria-label="طباعة الفاتورة"
                                        className="invoice-screen-action inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
                                    >
                                        <Printer size={17} />
                                        طباعة الفاتورة
                                    </button>
                                )}
                                {invoice.status === "completed" && (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setShowCancellationConfirmation(
                                                true,
                                            )
                                        }
                                        className="invoice-screen-action inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
                                    >
                                        <CircleX size={17} />
                                        إلغاء الفاتورة
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <DetailCard
                                label="التاريخ"
                                value={formatDateTime(invoice.createdAt)}
                            />
                            <DetailCard
                                label="العميل"
                                value={
                                    invoice.customerNameSnapshot ||
                                    "بيع نقدي"
                                }
                            />
                            <DetailCard
                                label="العملة"
                                value={invoice.currency}
                            />
                            <DetailCard
                                label="تاريخ الاعتماد"
                                value={
                                    invoice.completedAt
                                        ? formatDateTime(invoice.completedAt)
                                        : "لم تعتمد بعد"
                                }
                            />
                        </div>

                        {invoice.status === "completed" && (
                            <>
                                <p className="mt-5 rounded-xl bg-blue-50 px-4 py-4 text-sm font-semibold text-blue-700">
                                    تم ترحيل هذه الفاتورة إلى المخزون
                                    وحساب العميل.
                                </p>
                                <div className="mt-4 rounded-xl border border-slate-200 p-4">
                                    <h4 className="font-bold">
                                        حالة الدفع والحساب
                                    </h4>
                                    <p className="mt-2 text-sm text-slate-600">
                                        {getPaymentExplanation(invoice)}
                                    </p>
                                </div>
                                <div className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-3">
                                    <DetailCard
                                        label="حركات المخزون"
                                        value={`تم إنشاء ${formatNumber(invoice.stockMovementIds.length)} حركات مخزون`}
                                    />
                                    <DetailCard
                                        label="الحركة المالية"
                                        value={
                                            invoice.completionTransactionId !==
                                            null
                                                ? "تم إنشاء حركة مالية مرتبطة بالفاتورة"
                                                : "لم تُنشأ حركة مالية"
                                        }
                                    />
                                    <DetailCard
                                        label="وقت الاعتماد"
                                        value={
                                            invoice.completedAt
                                                ? formatDateTime(
                                                      invoice.completedAt,
                                                  )
                                                : "—"
                                        }
                                    />
                                </div>
                            </>
                        )}
                        {invoice.status === "cancelled" && (
                            <div className="mt-5 space-y-4">
                                <p className="rounded-xl bg-red-50 px-4 py-4 text-sm font-semibold text-red-700">
                                    تم إلغاء هذه الفاتورة وعكس آثارها على
                                    المخزون وحساب العميل.
                                </p>
                                <div className="grid gap-3 rounded-xl border border-red-100 bg-red-50/40 p-4 sm:grid-cols-2">
                                    <DetailCard
                                        label="تاريخ الإلغاء"
                                        value={
                                            invoice.cancelledAt
                                                ? formatDateTime(
                                                      invoice.cancelledAt,
                                                  )
                                                : "—"
                                        }
                                    />
                                    <DetailCard
                                        label="سبب الإلغاء"
                                        value={
                                            invoice.cancellationReason ||
                                            "—"
                                        }
                                    />
                                    <DetailCard
                                        label="تاريخ الاعتماد الأصلي"
                                        value={
                                            invoice.completedAt
                                                ? formatDateTime(
                                                      invoice.completedAt,
                                                  )
                                                : "—"
                                        }
                                    />
                                    <DetailCard
                                        label="حركات عكس المخزون"
                                        value={`تم إنشاء ${formatNumber(invoice.reversalStockMovementIds.length)} حركات عكس`}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <div className="border-b border-slate-200 p-5">
                            <h4 className="text-lg font-bold">
                                منتجات الفاتورة
                            </h4>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[900px] text-right text-sm">
                                <thead className="bg-slate-50 text-slate-600">
                                    <tr>
                                        <th className="px-4 py-3">
                                            التسلسل
                                        </th>
                                        <th className="px-4 py-3">
                                            الكود
                                        </th>
                                        <th className="px-4 py-3">
                                            المنتج
                                        </th>
                                        <th className="px-4 py-3">
                                            الوحدة
                                        </th>
                                        <th className="px-4 py-3">
                                            الكمية
                                        </th>
                                        <th className="px-4 py-3">
                                            سعر الوحدة
                                        </th>
                                        <th className="px-4 py-3">
                                            الإجمالي
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {items.map((item, index) => (
                                        <tr key={item.id}>
                                            <td className="px-4 py-4">
                                                {formatNumber(index + 1)}
                                            </td>
                                            <td className="px-4 py-4 font-semibold" dir="ltr">
                                                {
                                                    item.productCodeSnapshot
                                                }
                                            </td>
                                            <td className="px-4 py-4">
                                                {
                                                    item.productNameSnapshot
                                                }
                                            </td>
                                            <td className="px-4 py-4">
                                                {item.unit}
                                            </td>
                                            <td className="px-4 py-4">
                                                {formatQuantity(item.quantity)}
                                            </td>
                                            <td className="px-4 py-4">
                                                {formatSaleMoney(
                                                    item.unitPrice,
                                                    invoice.currency,
                                                )}
                                            </td>
                                            <td className="px-4 py-4 font-bold">
                                                {formatSaleMoney(
                                                    item.total,
                                                    invoice.currency,
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="grid gap-6 lg:grid-cols-2">
                        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                            <h4 className="font-bold">الملاحظات</h4>
                            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                                {invoice.note || "لا توجد ملاحظات."}
                            </p>
                        </div>
                        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                            <AmountRow
                                label="المجموع الفرعي"
                                value={formatSaleMoney(
                                    invoice.subtotal,
                                    invoice.currency,
                                )}
                            />
                            <AmountRow
                                label="الخصم"
                                value={formatSaleMoney(
                                    invoice.discount,
                                    invoice.currency,
                                )}
                            />
                            <AmountRow
                                label="الإجمالي النهائي"
                                value={formatSaleMoney(
                                    invoice.total,
                                    invoice.currency,
                                )}
                                strong
                            />
                            <AmountRow
                                label="المدفوع"
                                value={formatSaleMoney(
                                    invoice.paidAmount,
                                    invoice.currency,
                                )}
                            />
                            <AmountRow
                                label={
                                    getRemainingPresentation(
                                        invoice.remainingAmount,
                                        invoice.currency,
                                    ).label
                                }
                                value={
                                    getRemainingPresentation(
                                        invoice.remainingAmount,
                                        invoice.currency,
                                    ).value
                                }
                                strong
                            />
                        </div>
                    </div>
                </div>
            )}

            {invoice && (
                <PrintableSaleInvoice
                    invoice={invoice}
                    items={items}
                    customers={customers}
                />
            )}

            {invoice &&
                showFinalizeConfirmation &&
                invoice.status === "draft" && (
                    <FinalizeInvoiceDialog
                        invoiceNumber={normalizeWesternDigits(
                            invoice.invoiceNumber,
                        )}
                        customerName={
                            invoice.customerNameSnapshot || "بيع نقدي"
                        }
                        currency={invoice.currency}
                        total={invoice.total}
                        paidAmount={invoice.paidAmount}
                        remainingAmount={invoice.remainingAmount}
                        itemCount={items.length}
                        onClose={() =>
                            setShowFinalizeConfirmation(false)
                        }
                        onConfirm={finalizeInvoice}
                    />
                )}
            {invoice &&
                showCancellationConfirmation &&
                invoice.status === "completed" && (
                    <CancelInvoiceDialog
                        invoice={invoice}
                        itemCount={items.length}
                        onClose={() =>
                            setShowCancellationConfirmation(false)
                        }
                        onConfirm={cancelInvoice}
                    />
                )}
        </section>
    );
}

function CancelInvoiceDialog({
    invoice,
    itemCount,
    onClose,
    onConfirm,
}: {
    invoice: SaleInvoice;
    itemCount: number;
    onClose: () => void;
    onConfirm: (reason: string) => void;
}) {
    const [reason, setReason] = useState("");
    const [error, setError] = useState("");

    function submit() {
        if (!reason.trim()) {
            setError("سبب إلغاء الفاتورة مطلوب.");
            return;
        }
        onConfirm(reason.trim());
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-invoice-title"
        >
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
                <h3
                    id="cancel-invoice-title"
                    className="text-xl font-bold text-red-700"
                >
                    إلغاء الفاتورة
                </h3>
                <div className="mt-4 grid gap-2 rounded-xl bg-slate-50 p-4 text-sm">
                    <p>
                        رقم الفاتورة:{" "}
                        <strong dir="ltr">
                            {normalizeWesternDigits(
                                invoice.invoiceNumber,
                            )}
                        </strong>
                    </p>
                    <p>
                        العميل:{" "}
                        <strong>
                            {invoice.customerNameSnapshot || "بيع نقدي"}
                        </strong>
                    </p>
                    <p>
                        الإجمالي:{" "}
                        <strong>
                            {formatSaleMoney(
                                invoice.total,
                                invoice.currency,
                            )}
                        </strong>
                    </p>
                    <p>
                        عدد المنتجات:{" "}
                        <strong>
                            {formatNumber(itemCount)}
                        </strong>
                    </p>
                </div>
                <div className="mt-4 space-y-2 rounded-xl bg-red-50 p-4 text-sm text-red-700">
                    <p>ستُعاد كميات المنتجات إلى المخزون.</p>
                    <p>
                        سيُعكس أثر الحركة المالية المرتبطة على حساب
                        العميل إن وجدت.
                    </p>
                </div>
                <label className="mt-4 block text-sm font-semibold">
                    سبب إلغاء الفاتورة
                    <textarea
                        value={reason}
                        onChange={(event) => {
                            setReason(event.target.value);
                            setError("");
                        }}
                        rows={3}
                        className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-red-400"
                        placeholder="اكتب سبب الإلغاء"
                    />
                </label>
                {error && (
                    <p className="mt-2 text-sm font-semibold text-red-600">
                        {error}
                    </p>
                )}
                <div className="mt-6 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold hover:bg-slate-50"
                    >
                        تراجع
                    </button>
                    <button
                        type="button"
                        onClick={submit}
                        className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
                    >
                        تأكيد إلغاء الفاتورة
                    </button>
                </div>
            </div>
        </div>
    );
}

function DetailCard({
    label,
    value,
}: {
    label: string;
    value: string;
}) {
    return (
        <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="mt-2 font-semibold">{value}</p>
        </div>
    );
}

function AmountRow({
    label,
    value,
    strong = false,
}: {
    label: string;
    value: string;
    strong?: boolean;
}) {
    return (
        <div
            className={`flex justify-between gap-4 ${
                strong ? "font-bold" : "text-sm"
            }`}
        >
            <span className="text-slate-600">{label}</span>
            <span>{value}</span>
        </div>
    );
}

export default SaleDetailsPage;
