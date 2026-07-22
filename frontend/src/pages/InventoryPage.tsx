import {
    AlertTriangle,
    ArrowDownUp,
    Boxes,
    CircleDollarSign,
    Search,
    WalletCards,
} from "lucide-react";
import { useState } from "react";

/*
 * يمثل بيانات مخزون منتج واحد.
 *
 * quantity:
 * الكمية المتوفرة بالوحدة المحددة في unit.
 *
 * minimumQuantity:
 * يستخدم داخليًا لتحديد حالة المخزون، ولا يظهر في الجدول.
 *
 * sellPriceIqd و purchasePriceUsd:
 * يمثلان سعر الوحدة الواحدة، سواء كانت مترًا مربعًا أو قطعة.
 */
type InventoryItem = {
    id: number;
    code: string;
    name: string;
    quantity: number;
    unit: "متر مربع" | "قطعة";
    minimumQuantity: number;
    sellPriceIqd: number;
    purchasePriceUsd: number;
};

/*
 * بيانات مؤقتة لاختبار الواجهة.
 * سنستبدلها لاحقًا ببيانات قاعدة البيانات.
 */
const inventoryItems: InventoryItem[] = [
    {
        id: 1,
        code: "CER-001",
        name: "سيراميك رخامي أبيض",
        quantity: 126.5,
        unit: "متر مربع",
        minimumQuantity: 20,
        sellPriceIqd: 18000,
        purchasePriceUsd: 9.5,
    },
    {
        id: 2,
        code: "CER-002",
        name: "بورسلان رمادي",
        quantity: 14,
        unit: "متر مربع",
        minimumQuantity: 20,
        sellPriceIqd: 25000,
        purchasePriceUsd: 13,
    },
    {
        id: 3,
        code: "DEC-001",
        name: "قطعة ديكور جدارية",
        quantity: 36,
        unit: "قطعة",
        minimumQuantity: 10,
        sellPriceIqd: 12000,
        purchasePriceUsd: 6,
    },
    {
        id: 4,
        code: "DEC-002",
        name: "قطعة زخرفة سيراميك",
        quantity: 0,
        unit: "قطعة",
        minimumQuantity: 8,
        sellPriceIqd: 15000,
        purchasePriceUsd: 7.5,
    },
];

/*
 * تحدد حالة المنتج اعتمادًا على كميته الحالية وحده الأدنى.
 * الحد الأدنى لا يظهر للمستخدم في الجدول.
 */
function getStockStatus(item: InventoryItem) {
    if (item.quantity === 0) {
        return {
            label: "نافد",
            className: "bg-red-50 text-red-700",
        };
    }

    if (item.quantity <= item.minimumQuantity) {
        return {
            label: "منخفض",
            className: "bg-amber-50 text-amber-700",
        };
    }

    return {
        label: "متوفر",
        className: "bg-emerald-50 text-emerald-700",
    };
}

function InventoryPage() {
    const [searchTerm, setSearchTerm] = useState("");

    const normalizedSearch = searchTerm.trim().toLowerCase();

    const filteredItems = inventoryItems.filter((item) => {
        return (
            item.code.toLowerCase().includes(normalizedSearch) ||
            item.name.toLowerCase().includes(normalizedSearch)
        );
    });

    /*
     * نجمع كميات المتر المربع منفصلة عن القطع،
     * لأن جمع وحدتين مختلفتين في رقم واحد غير صحيح.
     */
    const totalSquareMeters = inventoryItems
        .filter((item) => item.unit === "متر مربع")
        .reduce((total, item) => total + item.quantity, 0);

    const totalPieces = inventoryItems
        .filter((item) => item.unit === "قطعة")
        .reduce((total, item) => total + item.quantity, 0);

    // عدد المنتجات المنخفضة أو النافدة.
    const lowStockCount = inventoryItems.filter((item) => {
        return item.quantity <= item.minimumQuantity;
    }).length;

    /*
     * قيمة المخزون الكلية بسعر البيع بالدينار:
     * نجمع كمية كل منتج مضروبة في سعر بيع وحدته.
     */
    const totalSellingValueIqd = inventoryItems.reduce((total, item) => {
        return total + item.quantity * item.sellPriceIqd;
    }, 0);

    /*
     * قيمة المخزون الكلية بسعر الشراء بالدولار:
     * نجمع كمية كل منتج مضروبة في سعر شراء وحدته.
     */
    const totalPurchaseValueUsd = inventoryItems.reduce((total, item) => {
        return total + item.quantity * item.purchasePriceUsd;
    }, 0);

    return (
        <section>
            {/* عنوان الصفحة وزر تسجيل حركة مخزون */}
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h3 className="text-2xl font-bold">المخزون</h3>

                    <p className="mt-1 text-sm text-slate-500">
                        متابعة الكميات المتوفرة وقيمة مخزون المعرض.
                    </p>
                </div>

                <button
                    type="button"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
                >
                    <ArrowDownUp size={18} />
                    <span>تسجيل حركة مخزون</span>
                </button>
            </div>

            {/* ملخص المخزون */}
            <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-500">إجمالي المساحة</p>

                            <p className="mt-2 text-2xl font-bold">
                                {totalSquareMeters.toLocaleString("ar-IQ")}
                            </p>

                            <p className="mt-1 text-sm text-slate-500">متر مربع</p>
                        </div>

                        <div className="rounded-xl bg-slate-100 p-3 text-slate-700">
                            <Boxes size={22} />
                        </div>
                    </div>
                </article>

                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-500">إجمالي القطع</p>

                            <p className="mt-2 text-2xl font-bold">
                                {totalPieces.toLocaleString("ar-IQ")}
                            </p>

                            <p className="mt-1 text-sm text-slate-500">قطعة</p>
                        </div>

                        <div className="rounded-xl bg-slate-100 p-3 text-slate-700">
                            <Boxes size={22} />
                        </div>
                    </div>
                </article>

                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-500">منخفض أو نافد</p>

                            <p className="mt-2 text-2xl font-bold">
                                {lowStockCount.toLocaleString("ar-IQ")}
                            </p>

                            <p className="mt-1 text-sm text-slate-500">منتج</p>
                        </div>

                        <div className="rounded-xl bg-amber-50 p-3 text-amber-700">
                            <AlertTriangle size={22} />
                        </div>
                    </div>
                </article>

                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-500">القيمة بسعر البيع</p>

                            <p className="mt-2 text-2xl font-bold">
                                {totalSellingValueIqd.toLocaleString("ar-IQ")}
                            </p>

                            <p className="mt-1 text-sm text-slate-500">دينار عراقي</p>
                        </div>

                        <div className="rounded-xl bg-emerald-50 p-3 text-emerald-700">
                            <WalletCards size={22} />
                        </div>
                    </div>
                </article>

                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:col-span-2 xl:col-span-1">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-500">القيمة بسعر الشراء</p>

                            <p className="mt-2 text-2xl font-bold">
                                {totalPurchaseValueUsd.toLocaleString("en-US", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                })}
                            </p>

                            <p className="mt-1 text-sm text-slate-500">دولار أمريكي</p>
                        </div>

                        <div className="rounded-xl bg-blue-50 p-3 text-blue-700">
                            <CircleDollarSign size={22} />
                        </div>
                    </div>
                </article>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                {/* البحث بالكود أو الاسم */}
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
                            placeholder="ابحث بالكود أو اسم المنتج"
                            className="w-full rounded-xl border border-slate-200 py-3 pr-10 pl-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                        />
                    </div>
                </div>

                {/* جدول المخزون */}
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px] text-right text-sm">
                        <thead className="bg-slate-50 text-slate-600">
                            <tr>
                                <th className="px-5 py-4 font-semibold">الكود</th>
                                <th className="px-5 py-4 font-semibold">المنتج</th>
                                <th className="px-5 py-4 font-semibold">الكمية المتوفرة</th>
                                <th className="px-5 py-4 font-semibold">الحالة</th>
                                <th className="px-5 py-4 font-semibold">
                                    القيمة بسعر البيع
                                </th>
                                <th className="px-5 py-4 font-semibold">
                                    القيمة بسعر الشراء
                                </th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-100">
                            {filteredItems.map((item) => {
                                const stockStatus = getStockStatus(item);

                                const sellingValue = item.quantity * item.sellPriceIqd;
                                const purchaseValue = item.quantity * item.purchasePriceUsd;

                                return (
                                    <tr
                                        key={item.id}
                                        className="transition hover:bg-slate-50"
                                    >
                                        <td className="px-5 py-4 font-medium">{item.code}</td>

                                        <td className="px-5 py-4">{item.name}</td>

                                        <td className="px-5 py-4 font-semibold">
                                            {item.quantity.toLocaleString("ar-IQ")}{" "}
                                            <span className="font-normal text-slate-500">
                                                {item.unit}
                                            </span>
                                        </td>

                                        <td className="px-5 py-4">
                                            <span
                                                className={[
                                                    "inline-flex rounded-full px-3 py-1 text-xs font-semibold",
                                                    stockStatus.className,
                                                ].join(" ")}
                                            >
                                                {stockStatus.label}
                                            </span>
                                        </td>

                                        <td className="px-5 py-4 font-semibold">
                                            {sellingValue.toLocaleString("ar-IQ")} د.ع
                                        </td>

                                        <td className="px-5 py-4 font-semibold">
                                            $
                                            {purchaseValue.toLocaleString("en-US", {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                            })}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {filteredItems.length === 0 && (
                    <div className="px-5 py-16 text-center">
                        <p className="font-semibold">لا توجد عناصر مخزون مطابقة</p>

                        <p className="mt-1 text-sm text-slate-500">
                            جرّب البحث بكود أو اسم مختلف.
                        </p>
                    </div>
                )}
            </div>
        </section>
    );
}

export default InventoryPage;