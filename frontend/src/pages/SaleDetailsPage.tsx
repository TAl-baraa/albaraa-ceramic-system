import { ArrowRight, Check, Pencil } from "lucide-react";
import { useState } from "react";
import {
    useNavigate,
    useParams,
    useSearchParams,
} from "react-router-dom";

import { useSales } from "../context/SalesContext";
import type { Currency } from "../types/customer";
import type { SaleInvoiceStatus } from "../types/sale";
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

function formatMoney(amount: number, currency: Currency) {
    return currency === "USD"
        ? `USD ${amount.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
          })}`
        : `${amount.toLocaleString("ar-IQ", {
              maximumFractionDigits: 0,
          })} د.ع`;
}

function SaleDetailsPage() {
    const navigate = useNavigate();
    const { invoiceId } = useParams();
    const [searchParams] = useSearchParams();
    const {
        getInvoiceById,
        getItemsByInvoiceId,
        completeDraftInvoice,
    } = useSales();
    const [showFinalizeConfirmation, setShowFinalizeConfirmation] =
        useState(false);
    const [completionError, setCompletionError] = useState("");
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
                    {completionError && (
                        <div className="whitespace-pre-line rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                            {completionError}
                        </div>
                    )}

                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="text-sm text-slate-500">
                                    فاتورة بيع
                                </p>
                                <h3 className="mt-1 text-2xl font-bold" dir="ltr">
                                    {invoice.invoiceNumber}
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
                            </div>
                        </div>

                        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <DetailCard
                                label="التاريخ"
                                value={new Date(
                                    invoice.createdAt,
                                ).toLocaleString("ar-IQ")}
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
                                        ? new Date(
                                              invoice.completedAt,
                                          ).toLocaleString("ar-IQ")
                                        : "لم تعتمد بعد"
                                }
                            />
                        </div>

                        {invoice.status === "completed" && (
                            <p className="mt-5 rounded-xl bg-blue-50 px-4 py-4 text-sm font-semibold text-blue-700">
                                تم ترحيل هذه الفاتورة إلى المخزون وحساب
                                العميل.
                            </p>
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
                                    {items.map((item) => (
                                        <tr key={item.id}>
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
                                                {item.quantity.toLocaleString(
                                                    "ar-IQ",
                                                )}
                                            </td>
                                            <td className="px-4 py-4">
                                                {formatMoney(
                                                    item.unitPrice,
                                                    invoice.currency,
                                                )}
                                            </td>
                                            <td className="px-4 py-4 font-bold">
                                                {formatMoney(
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
                                value={formatMoney(
                                    invoice.subtotal,
                                    invoice.currency,
                                )}
                            />
                            <AmountRow
                                label="الخصم"
                                value={formatMoney(
                                    invoice.discount,
                                    invoice.currency,
                                )}
                            />
                            <AmountRow
                                label="الإجمالي"
                                value={formatMoney(
                                    invoice.total,
                                    invoice.currency,
                                )}
                                strong
                            />
                            <AmountRow
                                label="المدفوع"
                                value={formatMoney(
                                    invoice.paidAmount,
                                    invoice.currency,
                                )}
                            />
                            <AmountRow
                                label={
                                    invoice.remainingAmount < 0
                                        ? "المبلغ الزائد"
                                        : "المتبقي"
                                }
                                value={formatMoney(
                                    Math.abs(
                                        invoice.remainingAmount,
                                    ),
                                    invoice.currency,
                                )}
                                strong
                            />
                        </div>
                    </div>
                </div>
            )}

            {invoice &&
                showFinalizeConfirmation &&
                invoice.status === "draft" && (
                    <FinalizeInvoiceDialog
                        invoiceNumber={invoice.invoiceNumber}
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
        </section>
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
