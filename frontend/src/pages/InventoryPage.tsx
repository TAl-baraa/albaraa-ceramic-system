import type { ReactNode } from "react";
import { useState } from "react";
import {
    AlertTriangle,
    ArrowDownUp,
    Boxes,
    CircleDollarSign,
    Search,
    WalletCards,
} from "lucide-react";


import { useProducts } from "../context/ProductsContext";
import type { Product } from "../types/product";

function getStockStatus(product: Product) {
    if (product.quantity === 0) {
        return {
            label: "نافد",
            className: "bg-red-50 text-red-700",
        };
    }

    if (product.quantity <= product.minimumQuantity) {
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
    const { products } = useProducts();

    const [searchTerm, setSearchTerm] = useState("");

    const normalizedSearch =
        searchTerm.trim().toLowerCase();

    const filteredProducts = products.filter(
        (product) => {
            return (
                product.code
                    .toLowerCase()
                    .includes(normalizedSearch) ||
                product.name
                    .toLowerCase()
                    .includes(normalizedSearch)
            );
        },
    );

    const totalSquareMeters = products
        .filter(
            (product) => product.unit === "متر مربع",
        )
        .reduce(
            (total, product) =>
                total + product.quantity,
            0,
        );

    const totalPieces = products
        .filter((product) => product.unit === "قطعة")
        .reduce(
            (total, product) =>
                total + product.quantity,
            0,
        );

    const lowStockCount = products.filter(
        (product) => {
            return (
                product.quantity <= product.minimumQuantity
            );
        },
    ).length;

    const totalSellingValueIqd = products.reduce(
        (total, product) => {
            return (
                total +
                product.quantity * product.sellPriceIqd
            );
        },
        0,
    );

    const totalPurchaseValueUsd = products.reduce(
        (total, product) => {
            return (
                total +
                product.quantity *
                product.purchasePriceUsd
            );
        },
        0,
    );

    return (
        <section>
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h3 className="text-2xl font-bold">
                        المخزون
                    </h3>

                    <p className="mt-1 text-sm text-slate-500">
                        متابعة الكميات المتوفرة وقيمة مخزون
                        المعرض.
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

            <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <InventorySummaryCard
                    label="إجمالي المساحة"
                    value={totalSquareMeters.toLocaleString(
                        "ar-IQ",
                    )}
                    unit="متر مربع"
                    icon={<Boxes size={22} />}
                    iconClassName="bg-slate-100 text-slate-700"
                />

                <InventorySummaryCard
                    label="إجمالي القطع"
                    value={totalPieces.toLocaleString("ar-IQ")}
                    unit="قطعة"
                    icon={<Boxes size={22} />}
                    iconClassName="bg-slate-100 text-slate-700"
                />

                <InventorySummaryCard
                    label="منخفض أو نافد"
                    value={lowStockCount.toLocaleString(
                        "ar-IQ",
                    )}
                    unit="منتج"
                    icon={<AlertTriangle size={22} />}
                    iconClassName="bg-amber-50 text-amber-700"
                />

                <InventorySummaryCard
                    label="القيمة بسعر البيع"
                    value={totalSellingValueIqd.toLocaleString(
                        "ar-IQ",
                    )}
                    unit="دينار عراقي"
                    icon={<WalletCards size={22} />}
                    iconClassName="bg-emerald-50 text-emerald-700"
                />

                <InventorySummaryCard
                    label="القيمة بسعر الشراء"
                    value={totalPurchaseValueUsd.toLocaleString(
                        "en-US",
                        {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                        },
                    )}
                    unit="دولار أمريكي"
                    icon={<CircleDollarSign size={22} />}
                    iconClassName="bg-blue-50 text-blue-700"
                    className="sm:col-span-2 xl:col-span-1"
                />
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 p-4 sm:p-5">
                    <div className="relative max-w-md">
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
                            placeholder="ابحث بالكود أو اسم المنتج"
                            className="w-full rounded-xl border border-slate-200 py-3 pr-10 pl-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px] text-right text-sm">
                        <thead className="bg-slate-50 text-slate-600">
                            <tr>
                                <th className="px-5 py-4 font-semibold">
                                    الكود
                                </th>

                                <th className="px-5 py-4 font-semibold">
                                    المنتج
                                </th>

                                <th className="px-5 py-4 font-semibold">
                                    الكمية المتوفرة
                                </th>

                                <th className="px-5 py-4 font-semibold">
                                    الحالة
                                </th>

                                <th className="px-5 py-4 font-semibold">
                                    القيمة بسعر البيع
                                </th>

                                <th className="px-5 py-4 font-semibold">
                                    القيمة بسعر الشراء
                                </th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-100">
                            {filteredProducts.map((product) => {
                                const stockStatus =
                                    getStockStatus(product);

                                const sellingValue =
                                    product.quantity *
                                    product.sellPriceIqd;

                                const purchaseValue =
                                    product.quantity *
                                    product.purchasePriceUsd;

                                return (
                                    <tr
                                        key={product.id}
                                        className="transition hover:bg-slate-50"
                                    >
                                        <td className="px-5 py-4 font-medium">
                                            {product.code}
                                        </td>

                                        <td className="px-5 py-4">
                                            {product.name}
                                        </td>

                                        <td className="px-5 py-4 font-semibold">
                                            {product.quantity.toLocaleString(
                                                "ar-IQ",
                                            )}{" "}
                                            <span className="font-normal text-slate-500">
                                                {product.unit}
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
                                            {sellingValue.toLocaleString(
                                                "ar-IQ",
                                            )}{" "}
                                            د.ع
                                        </td>

                                        <td className="px-5 py-4 font-semibold">
                                            $
                                            {purchaseValue.toLocaleString(
                                                "en-US",
                                                {
                                                    minimumFractionDigits: 2,
                                                    maximumFractionDigits: 2,
                                                },
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {filteredProducts.length === 0 && (
                    <div className="px-5 py-16 text-center">
                        <p className="font-semibold">
                            لا توجد عناصر مخزون مطابقة
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                            جرّب البحث بكود أو اسم مختلف.
                        </p>
                    </div>
                )}
            </div>
        </section>
    );
}

type InventorySummaryCardProps = {
    label: string;
    value: string;
    unit: string;
    icon: ReactNode;
    iconClassName: string;
    className?: string;
};

function InventorySummaryCard({
    label,
    value,
    unit,
    icon,
    iconClassName,
    className = "",
}: InventorySummaryCardProps) {
    return (
        <article
            className={[
                "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm",
                className,
            ].join(" ")}
        >
            <div className="flex items-center justify-between gap-4">
                <div>
                    <p className="text-sm text-slate-500">
                        {label}
                    </p>

                    <p className="mt-2 text-2xl font-bold">
                        {value}
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                        {unit}
                    </p>
                </div>

                <div
                    className={[
                        "rounded-xl p-3",
                        iconClassName,
                    ].join(" ")}
                >
                    {icon}
                </div>
            </div>
        </article>
    );
}

export default InventoryPage;