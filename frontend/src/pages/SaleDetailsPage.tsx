import { ArrowRight } from "lucide-react";
import {
    useNavigate,
    useParams,
    useSearchParams,
} from "react-router-dom";

import { useSales } from "../context/SalesContext";
import { SaleInvoiceEditor } from "./NewSalePage";
import type { Currency } from "../types/customer";
import type { SaleInvoiceStatus } from "../types/sale";

const statusLabels: Record<SaleInvoiceStatus, string> = {
    draft: "مسودة",
    completed: "مكتملة",
    cancelled: "ملغاة",
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
    const { getInvoiceById } = useSales();
    const numericInvoiceId = Number(invoiceId);
    const invoice = Number.isFinite(numericInvoiceId)
        ? getInvoiceById(numericInvoiceId)
        : undefined;

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

    return (
        <section className="mx-auto max-w-4xl">
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
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="text-sm text-slate-500">
                                فاتورة بيع
                            </p>
                            <h3 className="mt-1 text-2xl font-bold" dir="ltr">
                                {invoice.invoiceNumber}
                            </h3>
                        </div>
                        <span className="self-start rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold">
                            {statusLabels[invoice.status]}
                        </span>
                    </div>

                    <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <DetailCard
                            label="العميل"
                            value={
                                invoice.customerNameSnapshot ||
                                "عميل نقدي"
                            }
                        />
                        <DetailCard
                            label="الإجمالي"
                            value={formatMoney(
                                invoice.total,
                                invoice.currency,
                            )}
                        />
                        <DetailCard
                            label="المدفوع"
                            value={formatMoney(
                                invoice.paidAmount,
                                invoice.currency,
                            )}
                        />
                        <DetailCard
                            label="المتبقي"
                            value={formatMoney(
                                invoice.remainingAmount,
                                invoice.currency,
                            )}
                        />
                    </div>

                    <p className="mt-6 rounded-xl bg-blue-50 px-4 py-4 text-sm leading-6 text-blue-700">
                        سيتم استكمال عناصر المنتجات والتفاصيل الكاملة
                        للفاتورة في المرحلة القادمة.
                    </p>
                </div>
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

export default SaleDetailsPage;
