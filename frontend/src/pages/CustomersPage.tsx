import {
    AlertTriangle,
    CheckCircle2,
    Clock3,
    Plus,
    Search,
    Users,
    WalletCards,
} from "lucide-react";
import { useState } from "react";

/*
 * يمثل البيانات الحالية لعميل واحد.
 *
 * balance:
 * رقم موجب  = لنا مبلغ على العميل.
 * رقم سالب  = للعميل مبلغ علينا.
 * صفر       = الحساب مسدد.
 *
 * lastPaymentDate:
 * تاريخ آخر دفعة دفعها العميل.
 * تكون null إذا لم يسجل العميل أي دفعة حتى الآن.
 */
type Customer = {
    id: number;
    name: string;
    phone: string;
    balance: number;
    createdAt: string;
    lastPaymentDate: string | null;
};

/*
 * بيانات مؤقتة لاختبار الواجهة.
 *
 * لاحقًا لن نخزن الرصيد بهذه الطريقة فقط،
 * بل سيحسب من جميع الحركات المالية الخاصة بالعميل.
 */
const customers: Customer[] = [
    {
        id: 1,
        name: "أحمد محمد",
        phone: "07701234567",
        balance: 50000,
        createdAt: "2026-06-01",
        lastPaymentDate: "2026-07-10",
    },
    {
        id: 2,
        name: "محمود علي",
        phone: "07811234567",
        balance: -500000,
        createdAt: "2026-05-15",
        lastPaymentDate: null,
    },
    {
        id: 3,
        name: "شركة إعمار الموصل",
        phone: "07501234567",
        balance: 150000,
        createdAt: "2026-05-20",
        lastPaymentDate: "2026-06-12",
    },
    {
        id: 4,
        name: "علي حسن",
        phone: "07721234567",
        balance: 0,
        createdAt: "2026-07-01",
        lastPaymentDate: "2026-07-18",
    },
];

/*
 * عدد المللي ثانية الموجودة في يوم واحد.
 * نستخدمه لتحويل فرق الوقت إلى عدد أيام.
 */
const MILLISECONDS_PER_DAY = 1000 * 60 * 60 * 24;

/*
 * تحسب عدد الأيام منذ تاريخ معين وحتى اليوم.
 */
function calculateDaysSince(date: string) {
    const referenceDate = new Date(`${date}T00:00:00`);
    const today = new Date();

    /*
     * نزيل تأثير الساعة والدقائق حتى يكون الحساب
     * معتمدًا على التاريخ فقط.
     */
    today.setHours(0, 0, 0, 0);

    const differenceInMilliseconds =
        today.getTime() - referenceDate.getTime();

    return Math.max(
        0,
        Math.floor(differenceInMilliseconds / MILLISECONDS_PER_DAY),
    );
}

/*
 * تحدد حالة دفع العميل.
 *
 * إذا لم يسبق للعميل الدفع، نبدأ الحساب من تاريخ إضافته.
 * إذا دفع سابقًا، نبدأ الحساب من تاريخ آخر دفعة.
 */
function getPaymentStatus(customer: Customer) {
    if (customer.balance === 0) {
        return {
            label: "الحساب مسدد",
            description: "لا توجد مستحقات حالية",
            className: "bg-emerald-50 text-emerald-700",
            icon: CheckCircle2,
        };
    }

    const referenceDate =
        customer.lastPaymentDate ?? customer.createdAt;

    const daysSincePayment = calculateDaysSince(referenceDate);

    if (daysSincePayment > 30) {
        return {
            label: "متأخر عن الدفع",
            description: `منذ ${daysSincePayment.toLocaleString("ar-IQ")} يومًا`,
            className: "bg-red-50 text-red-700",
            icon: AlertTriangle,
        };
    }

    return {
        label: "ضمن المدة",
        description: `منذ ${daysSincePayment.toLocaleString("ar-IQ")} يومًا`,
        className: "bg-amber-50 text-amber-700",
        icon: Clock3,
    };
}

/*
 * تنسيق الرصيد بطريقة توضح اتجاه الدين.
 */
function formatCustomerBalance(balance: number) {
    const formattedAmount = Math.abs(balance).toLocaleString("ar-IQ");

    if (balance > 0) {
        return `${formattedAmount} د.ع لنا عليه`;
    }

    if (balance < 0) {
        return `${formattedAmount} د.ع له علينا`;
    }

    return "الحساب مسدد";
}

function CustomersPage() {
    const [searchTerm, setSearchTerm] = useState("");

    const normalizedSearch = searchTerm.trim().toLowerCase();

    // البحث بالاسم أو رقم الهاتف.
    const filteredCustomers = customers.filter((customer) => {
        return (
            customer.name.toLowerCase().includes(normalizedSearch) ||
            customer.phone.includes(normalizedSearch)
        );
    });

    /*
     * نجمع الأرصدة الموجبة فقط.
     *
     * مثال:
     * عميل كان عليه 100 ودفع 50، يصبح رصيده 50.
     * عميل كان عليه 500 ودفع 350، يصبح رصيده 150.
     * الإجمالي الصحيح هو 200.
     */
    const totalCustomersOweUs = customers
        .filter((customer) => customer.balance > 0)
        .reduce((total, customer) => {
            return total + customer.balance;
        }, 0);

    /*
     * نجمع الأرصدة السالبة فقط.
     *
     * نستخدم Math.abs لتحويل الناتج إلى رقم موجب للعرض.
     */
    const totalWeOweCustomers = Math.abs(
        customers
            .filter((customer) => customer.balance < 0)
            .reduce((total, customer) => {
                return total + customer.balance;
            }, 0),
    );

    return (
        <section>
            {/* عنوان الصفحة وزر إضافة عميل */}
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h3 className="text-2xl font-bold">العملاء</h3>

                    <p className="mt-1 text-sm text-slate-500">
                        إدارة بيانات العملاء ومتابعة أرصدتهم وحالة الدفع.
                    </p>
                </div>

                <button
                    type="button"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
                >
                    <Plus size={18} />
                    <span>إضافة عميل</span>
                </button>
            </div>

            {/* بطاقات ملخص العملاء */}
            <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-500">
                                إجمالي العملاء
                            </p>

                            <p className="mt-2 text-3xl font-bold">
                                {customers.length.toLocaleString("ar-IQ")}
                            </p>
                        </div>

                        <div className="rounded-xl bg-slate-100 p-3 text-slate-700">
                            <Users size={22} />
                        </div>
                    </div>
                </article>

                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-500">
                                صافي ديون العملاء لنا
                            </p>

                            <p className="mt-2 text-2xl font-bold">
                                {totalCustomersOweUs.toLocaleString("ar-IQ")}
                            </p>

                            <p className="mt-1 text-sm text-slate-500">
                                دينار عراقي
                            </p>
                        </div>

                        <div className="rounded-xl bg-red-50 p-3 text-red-700">
                            <WalletCards size={22} />
                        </div>
                    </div>
                </article>

                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:col-span-2 xl:col-span-1">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-500">
                                صافي ديوننا للعملاء
                            </p>

                            <p className="mt-2 text-2xl font-bold">
                                {totalWeOweCustomers.toLocaleString("ar-IQ")}
                            </p>

                            <p className="mt-1 text-sm text-slate-500">
                                دينار عراقي
                            </p>
                        </div>

                        <div className="rounded-xl bg-emerald-50 p-3 text-emerald-700">
                            <WalletCards size={22} />
                        </div>
                    </div>
                </article>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                {/* البحث بالاسم أو رقم الهاتف */}
                <div className="border-b border-slate-200 p-4 sm:p-5">
                    <div className="relative max-w-md">
                        <Search
                            size={19}
                            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                        />

                        <input
                            type="search"
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                            placeholder="ابحث بالاسم أو رقم الهاتف"
                            className="w-full rounded-xl border border-slate-200 py-3 pr-10 pl-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                        />
                    </div>
                </div>

                {/* جدول العملاء */}
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[850px] text-right text-sm">
                        <thead className="bg-slate-50 text-slate-600">
                            <tr>
                                <th className="px-5 py-4 font-semibold">
                                    العميل
                                </th>

                                <th className="px-5 py-4 font-semibold">
                                    رقم الهاتف
                                </th>

                                <th className="px-5 py-4 font-semibold">
                                    صافي الحساب
                                </th>

                                <th className="px-5 py-4 font-semibold">
                                    حالة الدفع
                                </th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-100">
                            {filteredCustomers.map((customer) => {
                                const paymentStatus = getPaymentStatus(customer);
                                const StatusIcon = paymentStatus.icon;

                                return (
                                    <tr
                                        key={customer.id}
                                        className="cursor-pointer transition hover:bg-slate-50"
                                    >
                                        <td className="px-5 py-4 font-semibold">
                                            {customer.name}
                                        </td>

                                        <td
                                            className="px-5 py-4 text-slate-600"
                                            dir="ltr"
                                        >
                                            {customer.phone}
                                        </td>

                                        <td className="px-5 py-4">
                                            <span
                                                className={[
                                                    "font-semibold",
                                                    customer.balance > 0
                                                        ? "text-red-700"
                                                        : customer.balance < 0
                                                            ? "text-emerald-700"
                                                            : "text-slate-500",
                                                ].join(" ")}
                                            >
                                                {formatCustomerBalance(customer.balance)}
                                            </span>
                                        </td>

                                        <td className="px-5 py-4">
                                            <div
                                                className={[
                                                    "inline-flex items-center gap-2 rounded-xl px-3 py-2",
                                                    paymentStatus.className,
                                                ].join(" ")}
                                            >
                                                <StatusIcon size={17} />

                                                <div>
                                                    <p className="text-xs font-semibold">
                                                        {paymentStatus.label}
                                                    </p>

                                                    <p className="mt-0.5 text-xs opacity-80">
                                                        {paymentStatus.description}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {filteredCustomers.length === 0 && (
                    <div className="px-5 py-16 text-center">
                        <p className="font-semibold">
                            لا يوجد عميل مطابق
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                            جرّب البحث باسم أو رقم هاتف مختلف.
                        </p>
                    </div>
                )}
            </div>
        </section>
    );
}

export default CustomersPage;