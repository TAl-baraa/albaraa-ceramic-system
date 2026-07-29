import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import {
    AlertTriangle,
    ArrowDownUp,
    Boxes,
    CircleDollarSign,
    FilePlus2,
    Package,
    PackageX,
    ReceiptText,
    ShoppingCart,
    UserPlus,
    Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useCustomers } from "../context/CustomersContext";
import { useProducts } from "../context/ProductsContext";
import { useSales } from "../context/SalesContext";
import type { Currency } from "../types/customer";
import type { SaleInvoiceStatus } from "../types/sale";
import {
    getDashboardActivities,
    getDashboardCustomerSummary,
    getDashboardSalesSummary,
    getInventoryWarnings,
} from "../utils/dashboardCalculations";
import { formatSaleMoney } from "../utils/salePresentation";

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

function DashboardPage() {
    const navigate = useNavigate();
    const { products, stockMovements } = useProducts();
    const { customers, transactions } = useCustomers();
    const { invoices } = useSales();
    const [selectedCurrency, setSelectedCurrency] =
        useState<Currency>("IQD");

    const lowStockCount = useMemo(
        () =>
            products.filter(
                (product) =>
                    product.quantity > 0 &&
                    product.quantity <= product.minimumQuantity,
            ).length,
        [products],
    );
    const outOfStockCount = useMemo(
        () =>
            products.filter((product) => product.quantity <= 0)
                .length,
        [products],
    );
    const salesSummary = useMemo(
        () =>
            getDashboardSalesSummary(
                invoices,
                selectedCurrency,
            ),
        [invoices, selectedCurrency],
    );
    const customerSummary = useMemo(
        () =>
            getDashboardCustomerSummary(
                customers,
                transactions,
                selectedCurrency,
            ),
        [customers, transactions, selectedCurrency],
    );
    const activities = useMemo(
        () =>
            getDashboardActivities({
                invoices,
                products,
                stockMovements,
                customers,
                transactions,
            }),
        [
            invoices,
            products,
            stockMovements,
            customers,
            transactions,
        ],
    );
    const inventoryWarnings = useMemo(
        () => getInventoryWarnings(products),
        [products],
    );
    const recentInvoices = useMemo(
        () =>
            invoices
                .toSorted(
                    (first, second) =>
                        Date.parse(second.createdAt) -
                            Date.parse(first.createdAt) ||
                        second.id - first.id,
                )
                .slice(0, 5),
        [invoices],
    );

    return (
        <div className="space-y-6">
            <section>
                <h3 className="text-2xl font-bold">
                    مرحبًا بك، البراء
                </h3>
                <p className="mt-1 text-slate-500">
                    نظرة مباشرة على المبيعات والمخزون وحسابات
                    العملاء.
                </p>
            </section>

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                    label="إجمالي المنتجات"
                    value={products.length.toLocaleString("ar-IQ")}
                    icon={<Package size={23} />}
                    iconClassName="bg-blue-50 text-blue-700"
                />
                <MetricCard
                    label="المنتجات منخفضة المخزون"
                    value={lowStockCount.toLocaleString("ar-IQ")}
                    icon={<AlertTriangle size={23} />}
                    iconClassName="bg-amber-50 text-amber-700"
                />
                <MetricCard
                    label="المنتجات النافدة"
                    value={outOfStockCount.toLocaleString("ar-IQ")}
                    icon={<PackageX size={23} />}
                    iconClassName="bg-red-50 text-red-700"
                />
                <MetricCard
                    label="العملاء"
                    value={customers.length.toLocaleString("ar-IQ")}
                    icon={<Users size={23} />}
                    iconClassName="bg-violet-50 text-violet-700"
                />
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <h4 className="text-lg font-bold">ملخص المبيعات</h4>
                    <CurrencyToggle
                        value={selectedCurrency}
                        onChange={setSelectedCurrency}
                    />
                </div>
                <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <CompactMetric
                        label="مبيعات اليوم"
                        value={formatSaleMoney(
                            salesSummary.todaySales,
                            selectedCurrency,
                        )}
                    />
                    <CompactMetric
                        label="مبيعات هذا الشهر"
                        value={formatSaleMoney(
                            salesSummary.monthlySales,
                            selectedCurrency,
                        )}
                    />
                    <CompactMetric
                        label="المبالغ المتبقية"
                        value={formatSaleMoney(
                            salesSummary.remainingTotal,
                            selectedCurrency,
                        )}
                    />
                    <CompactMetric
                        label="الفواتير المكتملة"
                        value={salesSummary.completedCount.toLocaleString(
                            "ar-IQ",
                        )}
                    />
                </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h4 className="text-lg font-bold">حسابات العملاء</h4>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <CompactMetric
                        label="لنا على العملاء"
                        value={formatSaleMoney(
                            customerSummary.receivables,
                            selectedCurrency,
                        )}
                        className="border-red-100 bg-red-50/50"
                    />
                    <CompactMetric
                        label="للعملاء علينا"
                        value={formatSaleMoney(
                            customerSummary.payables,
                            selectedCurrency,
                        )}
                        className="border-blue-100 bg-blue-50/50"
                    />
                </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h4 className="text-lg font-bold">آخر الحركات</h4>
                    {activities.length === 0 ? (
                        <EmptyState text="لا توجد حركات مسجلة بعد." />
                    ) : (
                        <div className="mt-4 divide-y divide-slate-100">
                            {activities.map((activity) => (
                                <button
                                    key={activity.key}
                                    type="button"
                                    onClick={() =>
                                        navigate(activity.target)
                                    }
                                    className="flex w-full items-start gap-3 py-3 text-right transition hover:bg-slate-50"
                                >
                                    <ActivityIcon kind={activity.kind} />
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-sm font-semibold">
                                            {activity.title}
                                        </span>
                                        <span className="mt-1 block truncate text-xs text-slate-500">
                                            {activity.reference}
                                            {activity.detail
                                                ? ` · ${activity.detail}`
                                                : ""}
                                        </span>
                                    </span>
                                    <time className="shrink-0 text-xs text-slate-400">
                                        {formatDateTime(activity.timestamp)}
                                    </time>
                                </button>
                            ))}
                        </div>
                    )}
                </article>

                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h4 className="text-lg font-bold">اختصارات سريعة</h4>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                        <QuickAction
                            label="إضافة منتج جديد"
                            icon={<FilePlus2 size={18} />}
                            onClick={() =>
                                navigate("/products?action=add")
                            }
                            primary
                        />
                        <QuickAction
                            label="فاتورة بيع جديدة"
                            icon={<ShoppingCart size={18} />}
                            onClick={() => navigate("/sales/new")}
                        />
                        <QuickAction
                            label="إضافة عميل"
                            icon={<UserPlus size={18} />}
                            onClick={() =>
                                navigate("/customers?action=add")
                            }
                        />
                        <QuickAction
                            label="تسجيل حركة مخزون"
                            icon={<ArrowDownUp size={18} />}
                            onClick={() =>
                                navigate("/inventory?action=movement")
                            }
                        />
                        <QuickAction
                            label="عرض جميع المبيعات"
                            icon={<ReceiptText size={18} />}
                            onClick={() => navigate("/sales")}
                        />
                        <QuickAction
                            label="عرض العملاء"
                            icon={<Users size={18} />}
                            onClick={() => navigate("/customers")}
                        />
                    </div>
                </article>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between gap-4 border-b border-slate-200 p-5">
                    <h4 className="text-lg font-bold">تنبيهات المخزون</h4>
                    <button
                        type="button"
                        onClick={() => navigate("/inventory")}
                        className="text-sm font-semibold text-blue-700 hover:underline"
                    >
                        عرض المخزون
                    </button>
                </div>
                {inventoryWarnings.length === 0 ? (
                    <EmptyState text="المخزون ضمن الحدود الآمنة." />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[720px] text-right text-sm">
                            <thead className="bg-slate-50 text-slate-600">
                                <tr>
                                    <th className="px-5 py-3">الكود</th>
                                    <th className="px-5 py-3">المنتج</th>
                                    <th className="px-5 py-3">المتوفر</th>
                                    <th className="px-5 py-3">الوحدة</th>
                                    <th className="px-5 py-3">الحد الأدنى</th>
                                    <th className="px-5 py-3">الحالة</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {inventoryWarnings.map((product) => (
                                    <tr key={product.id}>
                                        <td className="px-5 py-4 font-semibold" dir="ltr">
                                            {product.code}
                                        </td>
                                        <td className="px-5 py-4">{product.name}</td>
                                        <td className="px-5 py-4 font-bold">
                                            {product.quantity.toLocaleString("ar-IQ")}
                                        </td>
                                        <td className="px-5 py-4">{product.unit}</td>
                                        <td className="px-5 py-4">
                                            {product.minimumQuantity.toLocaleString("ar-IQ")}
                                        </td>
                                        <td className="px-5 py-4">
                                            <span
                                                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                                    product.quantity <= 0
                                                        ? "bg-red-50 text-red-700"
                                                        : "bg-amber-50 text-amber-700"
                                                }`}
                                            >
                                                {product.quantity <= 0 ? "نافد" : "منخفض"}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 p-5">
                    <h4 className="text-lg font-bold">أحدث الفواتير</h4>
                </div>
                {recentInvoices.length === 0 ? (
                    <EmptyState text="لا توجد فواتير مسجلة بعد." />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[900px] text-right text-sm">
                            <thead className="bg-slate-50 text-slate-600">
                                <tr>
                                    <th className="px-5 py-3">رقم الفاتورة</th>
                                    <th className="px-5 py-3">العميل</th>
                                    <th className="px-5 py-3">الإجمالي</th>
                                    <th className="px-5 py-3">العملة</th>
                                    <th className="px-5 py-3">الحالة</th>
                                    <th className="px-5 py-3">التاريخ</th>
                                    <th className="px-5 py-3">الإجراء</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {recentInvoices.map((invoice) => (
                                    <tr key={invoice.id}>
                                        <td className="px-5 py-4 font-semibold" dir="ltr">
                                            {invoice.invoiceNumber}
                                        </td>
                                        <td className="px-5 py-4">
                                            {invoice.customerNameSnapshot || "بيع نقدي"}
                                        </td>
                                        <td className="px-5 py-4 font-semibold">
                                            {formatSaleMoney(invoice.total, invoice.currency)}
                                        </td>
                                        <td className="px-5 py-4">{invoice.currency}</td>
                                        <td className="px-5 py-4">
                                            <span
                                                className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClasses[invoice.status]}`}
                                            >
                                                {statusLabels[invoice.status]}
                                            </span>
                                        </td>
                                        <td className="whitespace-nowrap px-5 py-4 text-slate-500">
                                            {formatDateTime(invoice.createdAt)}
                                        </td>
                                        <td className="px-5 py-4">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    navigate(`/sales/${invoice.id}`)
                                                }
                                                className="font-semibold text-blue-700 hover:underline"
                                            >
                                                عرض
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    );
}

function MetricCard({
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
                    <p className="mt-2 text-3xl font-bold">{value}</p>
                </div>
                <div className={`rounded-xl p-3 ${iconClassName}`}>
                    {icon}
                </div>
            </div>
        </article>
    );
}

function CompactMetric({
    label,
    value,
    className = "",
}: {
    label: string;
    value: string;
    className?: string;
}) {
    return (
        <article
            className={`rounded-xl border border-slate-100 bg-slate-50 p-4 ${className}`}
        >
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-2 text-xl font-bold">{value}</p>
        </article>
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
            aria-label="عملة عرض لوحة التحكم"
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
                    className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                        value === currency
                            ? "bg-white text-slate-900 shadow-sm"
                            : "text-slate-500"
                    }`}
                >
                    {label}
                </button>
            ))}
        </div>
    );
}

function QuickAction({
    label,
    icon,
    onClick,
    primary = false,
}: {
    label: string;
    icon: ReactNode;
    onClick: () => void;
    primary?: boolean;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                primary
                    ? "bg-slate-900 text-white hover:bg-slate-700"
                    : "border border-slate-200 hover:bg-slate-50"
            }`}
        >
            {icon}
            {label}
        </button>
    );
}

function ActivityIcon({
    kind,
}: {
    kind: "sale" | "inventory" | "customer";
}) {
    const styles = {
        sale: "bg-emerald-50 text-emerald-700",
        inventory: "bg-amber-50 text-amber-700",
        customer: "bg-blue-50 text-blue-700",
    };
    const icons = {
        sale: <ReceiptText size={18} />,
        inventory: <Boxes size={18} />,
        customer: <CircleDollarSign size={18} />,
    };
    return (
        <span className={`rounded-xl p-2.5 ${styles[kind]}`}>
            {icons[kind]}
        </span>
    );
}

function EmptyState({ text }: { text: string }) {
    return (
        <div className="px-5 py-12 text-center text-sm text-slate-400">
            {text}
        </div>
    );
}

function formatDateTime(value: string) {
    const date = new Date(value);
    return Number.isFinite(date.getTime())
        ? date.toLocaleString("ar-IQ", {
              dateStyle: "short",
              timeStyle: "short",
          })
        : "—";
}

export default DashboardPage;
