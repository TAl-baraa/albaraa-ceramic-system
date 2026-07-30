import { ArrowRight, Printer } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import {
    useNavigate,
    useParams,
    useSearchParams,
} from "react-router-dom";

import PrintableCustomerStatement from "../components/customers/PrintableCustomerStatement";
import { useCustomers } from "../context/CustomersContext";
import { useSales } from "../context/SalesContext";
import type { Currency } from "../types/customer";
import {
    buildCustomerStatement,
    getStatementBalanceLabel,
} from "../utils/customerStatement";
import {
    formatCurrency,
    formatDateTime,
    formatPhoneNumber,
    formatQuantity,
    normalizeWesternDigits,
} from "../utils/formatters";

function localDateInput(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function parseLocalDate(value: string, endOfDay = false) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return undefined;
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    return new Date(
        year,
        month,
        day,
        endOfDay ? 23 : 0,
        endOfDay ? 59 : 0,
        endOfDay ? 59 : 0,
        endOfDay ? 999 : 0,
    );
}

function CustomerStatementPage() {
    const navigate = useNavigate();
    const { customerId } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const { customers, transactions } = useCustomers();
    const { invoices, invoiceItems } = useSales();
    const numericCustomerId = Number(customerId);
    const customer = Number.isFinite(numericCustomerId)
        ? customers.find(
              (currentCustomer) =>
                  currentCustomer.id === numericCustomerId,
          )
        : undefined;
    const queryCurrency = searchParams.get("currency");
    const currency: Currency =
        queryCurrency === "USD" ? "USD" : "IQD";
    const [startDateInput, setStartDateInput] = useState("");
    const [endDateInput, setEndDateInput] = useState(() =>
        localDateInput(new Date()),
    );
    const [showVoided, setShowVoided] = useState(false);
    const generatedAt = useMemo(() => new Date(), []);
    const startDate = useMemo(
        () => parseLocalDate(startDateInput),
        [startDateInput],
    );
    const endDate = useMemo(
        () => parseLocalDate(endDateInput, true) ?? new Date(),
        [endDateInput],
    );
    const statement = useMemo(
        () =>
            customer
                ? buildCustomerStatement({
                      customer,
                      currency,
                      invoices,
                      invoiceItems,
                      transactions,
                      startDate,
                      endDate,
                      showVoided,
                  })
                : null,
        [
            customer,
            currency,
            invoices,
            invoiceItems,
            transactions,
            startDate,
            endDate,
            showVoided,
        ],
    );

    function selectCurrency(nextCurrency: Currency) {
        const next = new URLSearchParams(searchParams);
        next.set("currency", nextCurrency);
        setSearchParams(next, { replace: true });
    }

    function goBack() {
        if (!customer) {
            navigate("/customers");
            return;
        }
        navigate(
            `/customers?customerId=${customer.id}&currency=${currency}`,
        );
    }

    if (!customer || !statement) {
        return (
            <section className="mx-auto max-w-5xl">
                <button
                    type="button"
                    onClick={() => navigate("/customers")}
                    className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-600"
                >
                    <ArrowRight size={18} />
                    العودة إلى العملاء
                </button>
                <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
                    <h3 className="text-xl font-bold">
                        العميل غير موجود
                    </h3>
                    <p className="mt-2 text-sm text-slate-500">
                        تعذر إنشاء كشف الحساب لهذا العميل.
                    </p>
                </div>
            </section>
        );
    }

    return (
        <section className="mx-auto max-w-7xl space-y-6">
            <div className="statement-screen-only flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <button
                        type="button"
                        onClick={goBack}
                        className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
                    >
                        <ArrowRight size={18} />
                        العودة إلى العميل
                    </button>
                    <h3 className="text-2xl font-bold">
                        كشف حساب عميل
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                        الحركات التفصيلية والفواتير والرصيد الجاري.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700"
                >
                    <Printer size={18} />
                    طباعة كشف الحساب
                </button>
            </div>

            <div className="statement-screen-only rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                    <label className="grid gap-2">
                        <span className="text-sm font-semibold">
                            العملة
                        </span>
                        <div className="inline-flex rounded-xl bg-slate-100 p-1">
                            {(["IQD", "USD"] as const).map(
                                (option) => (
                                    <button
                                        key={option}
                                        type="button"
                                        onClick={() =>
                                            selectCurrency(option)
                                        }
                                        className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${
                                            currency === option
                                                ? "bg-white shadow-sm"
                                                : "text-slate-500"
                                        }`}
                                    >
                                        {option === "IQD"
                                            ? "الدينار العراقي"
                                            : "الدولار الأمريكي"}
                                    </button>
                                ),
                            )}
                        </div>
                    </label>
                    <label className="grid gap-2">
                        <span className="text-sm font-semibold">
                            من تاريخ
                        </span>
                        <input
                            type="date"
                            lang="en"
                            value={startDateInput}
                            onChange={(event) =>
                                setStartDateInput(event.target.value)
                            }
                            className="rounded-xl border border-slate-200 px-3 py-2.5"
                        />
                    </label>
                    <label className="grid gap-2">
                        <span className="text-sm font-semibold">
                            إلى تاريخ
                        </span>
                        <input
                            type="date"
                            lang="en"
                            value={endDateInput}
                            onChange={(event) =>
                                setEndDateInput(event.target.value)
                            }
                            className="rounded-xl border border-slate-200 px-3 py-2.5"
                        />
                    </label>
                    <label className="flex items-center gap-2 self-end rounded-xl bg-slate-50 px-4 py-3 text-sm font-semibold">
                        <input
                            type="checkbox"
                            checked={!startDateInput}
                            onChange={(event) => {
                                if (event.target.checked) {
                                    setStartDateInput("");
                                }
                            }}
                        />
                        جميع الحركات
                    </label>
                    <label className="flex items-center gap-2 self-end rounded-xl bg-slate-50 px-4 py-3 text-sm font-semibold">
                        <input
                            type="checkbox"
                            checked={showVoided}
                            onChange={(event) =>
                                setShowVoided(event.target.checked)
                            }
                        />
                        إظهار الحركات الملغاة
                    </label>
                </div>
            </div>

            <div className="statement-screen-only rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Info label="العميل" value={customer.name} />
                    <Info
                        label="الهاتف"
                        value={
                            customer.phone
                                ? formatPhoneNumber(customer.phone)
                                : "—"
                        }
                    />
                    <Info
                        label="العنوان"
                        value={customer.address || "—"}
                    />
                    <Info
                        label="تاريخ إنشاء الكشف"
                        value={formatDateTime(generatedAt)}
                    />
                </div>
            </div>

            <div className="statement-screen-only grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
                <SummaryCard
                    label="الرصيد الافتتاحي"
                    value={formatCurrency(
                        statement.openingBalance,
                        currency,
                    )}
                />
                <SummaryCard
                    label="إجمالي المبيعات"
                    value={formatCurrency(
                        statement.totalSales,
                        currency,
                    )}
                />
                <SummaryCard
                    label="إجمالي المدفوعات"
                    value={formatCurrency(
                        statement.totalPayments,
                        currency,
                    )}
                />
                <SummaryCard
                    label="لنا على العميل"
                    value={formatCurrency(
                        Math.max(statement.finalBalance, 0),
                        currency,
                    )}
                />
                <SummaryCard
                    label="للعميل علينا"
                    value={formatCurrency(
                        Math.abs(Math.min(statement.finalBalance, 0)),
                        currency,
                    )}
                />
                <SummaryCard
                    label="صافي الحساب"
                    value={getStatementBalanceLabel(
                        statement.finalBalance,
                        currency,
                    )}
                />
            </div>

            <div className="statement-screen-only overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[950px] text-right text-sm">
                        <thead className="bg-slate-900 text-white">
                            <tr>
                                <th className="px-4 py-3">التاريخ</th>
                                <th className="px-4 py-3">البيان</th>
                                <th className="px-4 py-3">لنا عليه</th>
                                <th className="px-4 py-3">له علينا</th>
                                <th className="px-4 py-3">الرصيد</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {startDate && (
                                <tr className="bg-blue-50/60 font-semibold text-blue-900">
                                    <td className="px-4 py-4">
                                        {formatDateTime(startDate)}
                                    </td>
                                    <td className="px-4 py-4">
                                        الرصيد الافتتاحي
                                    </td>
                                    <td className="px-4 py-4">—</td>
                                    <td className="px-4 py-4">—</td>
                                    <td className="px-4 py-4">
                                        {formatCurrency(
                                            statement.openingBalance,
                                            currency,
                                        )}
                                    </td>
                                </tr>
                            )}
                            {statement.entries.map((entry) => (
                                <Fragment key={entry.key}>
                                    <tr
                                        className={
                                            entry.status === "voided"
                                                ? "text-slate-400 line-through"
                                                : ""
                                        }
                                    >
                                        <td className="whitespace-nowrap px-4 py-4">
                                            {formatDateTime(entry.timestamp)}
                                        </td>
                                        <td className="px-4 py-4">
                                            <strong>{entry.description}</strong>
                                            {entry.statusLabel && (
                                                <span className="mr-2 rounded-full bg-slate-100 px-2 py-1 text-xs">
                                                    {entry.statusLabel}
                                                </span>
                                            )}
                                            <p className="mt-1 text-xs text-slate-500">
                                                {entry.note ||
                                                    entry.sourceReference ||
                                                    "—"}
                                            </p>
                                            {entry.invoiceDetailsMissing && (
                                                <p className="mt-1 text-xs text-red-600">
                                                    تعذر تحميل تفاصيل الفاتورة
                                                </p>
                                            )}
                                        </td>
                                        <td className="px-4 py-4">
                                            {entry.debit
                                                ? formatCurrency(
                                                      entry.debit,
                                                      currency,
                                                  )
                                                : "—"}
                                        </td>
                                        <td className="px-4 py-4">
                                            {entry.credit
                                                ? formatCurrency(
                                                      entry.credit,
                                                      currency,
                                                  )
                                                : "—"}
                                        </td>
                                        <td className="px-4 py-4 font-bold">
                                            {formatCurrency(
                                                entry.runningBalance,
                                                currency,
                                            )}
                                        </td>
                                    </tr>
                                    {entry.invoice && (
                                        <tr
                                            className={`bg-slate-50/70 ${
                                                entry.status === "voided"
                                                    ? "opacity-60 line-through"
                                                    : ""
                                            }`}
                                        >
                                            <td colSpan={5} className="p-4">
                                                <div className="mb-3 flex flex-wrap gap-4 text-xs font-semibold text-slate-600">
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
                                                            entry.invoice
                                                                .paidAmount,
                                                            currency,
                                                        )}
                                                    </span>
                                                    <span>
                                                        المسجل على الحساب:{" "}
                                                        {formatCurrency(
                                                            Math.abs(
                                                                entry.effect,
                                                            ),
                                                            currency,
                                                        )}
                                                    </span>
                                                </div>
                                                {entry.invoiceItems.length ===
                                                0 ? (
                                                    <p className="text-sm text-red-600">
                                                        تعذر تحميل تفاصيل
                                                        الفاتورة
                                                    </p>
                                                ) : (
                                                    <div className="overflow-x-auto">
                                                        <table className="w-full min-w-[720px] text-xs">
                                                            <thead className="text-slate-500">
                                                                <tr>
                                                                    <th className="py-2">
                                                                        الكود
                                                                    </th>
                                                                    <th className="py-2">
                                                                        المادة
                                                                    </th>
                                                                    <th className="py-2">
                                                                        الوحدة
                                                                    </th>
                                                                    <th className="py-2">
                                                                        الكمية
                                                                    </th>
                                                                    <th className="py-2">
                                                                        سعر الوحدة
                                                                    </th>
                                                                    <th className="py-2">
                                                                        الإجمالي
                                                                    </th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {entry.invoiceItems.map(
                                                                    (item) => (
                                                                        <tr
                                                                            key={
                                                                                item.id
                                                                            }
                                                                            className="border-t border-slate-200"
                                                                        >
                                                                            <td className="py-2" dir="ltr">
                                                                                {normalizeWesternDigits(
                                                                                    item.productCodeSnapshot,
                                                                                )}
                                                                            </td>
                                                                            <td className="py-2">
                                                                                {
                                                                                    item.productNameSnapshot
                                                                                }
                                                                            </td>
                                                                            <td className="py-2">
                                                                                {
                                                                                    item.unit
                                                                                }
                                                                            </td>
                                                                            <td className="py-2">
                                                                                {formatQuantity(
                                                                                    item.quantity,
                                                                                )}
                                                                            </td>
                                                                            <td className="py-2">
                                                                                {formatCurrency(
                                                                                    item.unitPrice,
                                                                                    currency,
                                                                                )}
                                                                            </td>
                                                                            <td className="py-2">
                                                                                {formatCurrency(
                                                                                    item.total,
                                                                                    currency,
                                                                                )}
                                                                            </td>
                                                                        </tr>
                                                                    ),
                                                                )}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    )}
                                </Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
                {statement.entries.length === 0 && (
                    <div className="p-12 text-center text-sm text-slate-500">
                        لا توجد حركات ضمن الفترة المحددة.
                    </div>
                )}
            </div>

            <PrintableCustomerStatement
                statement={statement}
                startDate={startDate}
                endDate={endDate}
                generatedAt={generatedAt}
            />
        </section>
    );
}

function Info({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="mt-2 font-semibold">{value}</p>
        </div>
    );
}

function SummaryCard({
    label,
    value,
}: {
    label: string;
    value: string;
}) {
    return (
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="mt-2 text-sm font-bold">{value}</p>
        </article>
    );
}

export default CustomerStatementPage;
