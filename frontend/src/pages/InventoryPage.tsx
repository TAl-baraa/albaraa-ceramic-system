import type { FormEvent, ReactNode } from "react";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
    AlertTriangle,
    ArrowDownUp,
    Boxes,
    CircleDollarSign,
    Search,
    WalletCards,
    X,
} from "lucide-react";


import { useProducts } from "../context/ProductsContext";
import type { Product } from "../types/product";
import type {
    StockMovement,
    StockMovementType,
} from "../types/stockMovement";
import {
    formatCurrency,
    formatDateTime,
    formatNumber,
    formatQuantity,
    normalizeWesternDigits,
} from "../utils/formatters";

const movementTypeLabels: Record<StockMovementType, string> = {
    in: "إدخال",
    out: "إخراج",
    adjustment: "تصحيح",
};

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
    const [searchParams, setSearchParams] = useSearchParams();
    const {
        products,
        stockMovements,
        addStockMovement,
    } = useProducts();

    const [searchTerm, setSearchTerm] = useState("");
    const [movementSearchTerm, setMovementSearchTerm] =
        useState("");
    const [isMovementDialogOpen, setIsMovementDialogOpen] =
        useState(false);
    const [selectedProductId, setSelectedProductId] =
        useState("");
    const [movementType, setMovementType] =
        useState<StockMovementType>("in");
    const [movementQuantity, setMovementQuantity] =
        useState("");
    const [movementNote, setMovementNote] = useState("");
    const [movementError, setMovementError] = useState("");

    const selectedProduct = products.find(
        (product) => product.id === Number(selectedProductId),
    );

    function resetMovementForm() {
        setSelectedProductId("");
        setMovementType("in");
        setMovementQuantity("");
        setMovementNote("");
        setMovementError("");
    }

    function openMovementDialog() {
        resetMovementForm();
        setIsMovementDialogOpen(true);
    }

    useEffect(() => {
        if (searchParams.get("action") !== "movement") {
            return;
        }
        openMovementDialog();
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete("action");
        setSearchParams(nextParams, { replace: true });
    }, [searchParams, setSearchParams]);

    function closeMovementDialog() {
        setIsMovementDialogOpen(false);
        resetMovementForm();
    }

    async function handleMovementSubmit(
        event: FormEvent<HTMLFormElement>,
    ) {
        event.preventDefault();

        if (!selectedProduct) {
            setMovementError("يرجى اختيار منتج.");
            return;
        }

        const quantity = Number(movementQuantity);

        if (
            movementQuantity.trim() === "" ||
            !Number.isFinite(quantity) ||
            quantity < 0 ||
            (movementType !== "adjustment" && quantity === 0)
        ) {
            setMovementError(
                movementType === "adjustment"
                    ? "يجب أن تكون الكمية الجديدة صفرًا أو رقمًا موجبًا."
                    : "يجب أن تكون الكمية رقمًا موجبًا.",
            );
            return;
        }

        if (
            selectedProduct.unit === "قطعة" &&
            !Number.isInteger(quantity)
        ) {
            setMovementError(
                "كميات المنتجات المقاسة بالقطعة يجب أن تكون أعدادًا صحيحة.",
            );
            return;
        }

        if (
            movementType === "out" &&
            quantity > selectedProduct.quantity
        ) {
            setMovementError(
                "كمية الإخراج أكبر من الكمية المتوفرة.",
            );
            return;
        }

        const result = await addStockMovement({
            productId: selectedProduct.id,
            type: movementType,
            quantity,
            note: movementNote,
        });

        if (!result.success) {
            setMovementError(result.error);
            return;
        }

        closeMovementDialog();
    }

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

    const normalizedMovementSearch =
        movementSearchTerm.trim().toLowerCase();

    const filteredMovements = stockMovements.filter(
        (movement) => {
            if (!normalizedMovementSearch) {
                return true;
            }

            const product = products.find(
                (currentProduct) =>
                    currentProduct.id === movement.productId,
            );

            return (
                product?.code
                    .toLowerCase()
                    .includes(normalizedMovementSearch) === true ||
                product?.name
                    .toLowerCase()
                    .includes(normalizedMovementSearch) === true
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
                    onClick={openMovementDialog}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
                >
                    <ArrowDownUp size={18} />
                    <span>تسجيل حركة مخزون</span>
                </button>
            </div>

            <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <InventorySummaryCard
                    label="إجمالي المساحة"
                    value={formatQuantity(totalSquareMeters)}
                    unit="متر مربع"
                    icon={<Boxes size={22} />}
                    iconClassName="bg-slate-100 text-slate-700"
                />

                <InventorySummaryCard
                    label="إجمالي القطع"
                    value={formatQuantity(totalPieces)}
                    unit="قطعة"
                    icon={<Boxes size={22} />}
                    iconClassName="bg-slate-100 text-slate-700"
                />

                <InventorySummaryCard
                    label="منخفض أو نافد"
                    value={formatNumber(lowStockCount)}
                    unit="منتج"
                    icon={<AlertTriangle size={22} />}
                    iconClassName="bg-amber-50 text-amber-700"
                />

                <InventorySummaryCard
                    label="القيمة بسعر البيع"
                    value={formatCurrency(totalSellingValueIqd, "IQD")}
                    unit="دينار عراقي"
                    icon={<WalletCards size={22} />}
                    iconClassName="bg-emerald-50 text-emerald-700"
                />

                <InventorySummaryCard
                    label="القيمة بسعر الشراء"
                    value={formatCurrency(totalPurchaseValueUsd, "USD")}
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
                                            {formatQuantity(product.quantity)}{" "}
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
                                            {formatCurrency(sellingValue, "IQD")}
                                        </td>

                                        <td className="px-5 py-4 font-semibold">
                                            {formatCurrency(purchaseValue, "USD")}
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

            <div className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-col gap-4 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                    <div>
                        <h4 className="text-lg font-bold">
                            سجل حركات المخزون
                        </h4>
                        <p className="mt-1 text-sm text-slate-500">
                            جميع عمليات الإدخال والإخراج والتصحيح.
                        </p>
                    </div>

                    <div className="relative w-full sm:max-w-sm">
                        <Search
                            size={19}
                            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                        />
                        <input
                            type="search"
                            value={movementSearchTerm}
                            onChange={(event) =>
                                setMovementSearchTerm(event.target.value)
                            }
                            placeholder="ابحث بكود أو اسم المنتج"
                            className="w-full rounded-xl border border-slate-200 py-3 pr-10 pl-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full min-w-[1100px] text-right text-sm">
                        <thead className="bg-slate-50 text-slate-600">
                            <tr>
                                <th className="px-5 py-4 font-semibold">التاريخ</th>
                                <th className="px-5 py-4 font-semibold">المنتج</th>
                                <th className="px-5 py-4 font-semibold">الكود</th>
                                <th className="px-5 py-4 font-semibold">نوع الحركة</th>
                                <th className="px-5 py-4 font-semibold">الكمية</th>
                                <th className="px-5 py-4 font-semibold">الكمية السابقة</th>
                                <th className="px-5 py-4 font-semibold">الكمية الجديدة</th>
                                <th className="px-5 py-4 font-semibold">الملاحظة</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredMovements.map((movement) => (
                                <MovementHistoryRow
                                    key={movement.id}
                                    movement={movement}
                                    product={products.find(
                                        (product) =>
                                            product.id === movement.productId,
                                    )}
                                />
                            ))}
                        </tbody>
                    </table>
                </div>

                {filteredMovements.length === 0 && (
                    <div className="px-5 py-16 text-center">
                        <p className="font-semibold">
                            لا توجد حركات مخزون مطابقة
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                            ستظهر الحركات هنا بعد تسجيلها.
                        </p>
                    </div>
                )}
            </div>

            {isMovementDialogOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <button
                        type="button"
                        onClick={closeMovementDialog}
                        aria-label="إغلاق نافذة حركة المخزون"
                        className="absolute inset-0 bg-slate-950/50"
                    />

                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="movement-dialog-title"
                        className="relative z-10 max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-xl"
                    >
                        <div className="flex items-center justify-between border-b border-slate-200 p-5">
                            <div>
                                <h4
                                    id="movement-dialog-title"
                                    className="text-lg font-bold"
                                >
                                    تسجيل حركة مخزون
                                </h4>
                                <p className="mt-1 text-sm text-slate-500">
                                    حدّث كمية منتج وسجّل تفاصيل الحركة.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={closeMovementDialog}
                                aria-label="إغلاق"
                                className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form
                            onSubmit={handleMovementSubmit}
                            className="p-5"
                        >
                            <div className="grid gap-5">
                                <label className="grid gap-2">
                                    <span className="text-sm font-semibold">
                                        المنتج
                                    </span>
                                    <select
                                        value={selectedProductId}
                                        onChange={(event) => {
                                            setSelectedProductId(
                                                event.target.value,
                                            );
                                            setMovementError("");
                                        }}
                                        autoFocus
                                        className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                                    >
                                        <option value="">
                                            اختر منتجًا
                                        </option>
                                        {products.map((product) => (
                                            <option
                                                key={product.id}
                                                value={product.id}
                                            >
                                                {product.code} — {product.name} — {formatQuantity(product.quantity)} {product.unit}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <div className="grid gap-5 sm:grid-cols-2">
                                    <label className="grid gap-2">
                                        <span className="text-sm font-semibold">
                                            نوع الحركة
                                        </span>
                                        <select
                                            value={movementType}
                                            onChange={(event) => {
                                                setMovementType(
                                                    event.target.value as StockMovementType,
                                                );
                                                setMovementError("");
                                            }}
                                            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                                        >
                                            <option value="in">إدخال</option>
                                            <option value="out">إخراج</option>
                                            <option value="adjustment">تصحيح</option>
                                        </select>
                                    </label>

                                    <label className="grid gap-2">
                                        <span className="text-sm font-semibold">
                                            {movementType === "adjustment"
                                                ? "الكمية الجديدة"
                                                : "الكمية"}
                                        </span>
                                        <input
                                            type="number"
                                            lang="en"
                                            min="0"
                                            step={
                                                selectedProduct?.unit === "قطعة"
                                                    ? "1"
                                                    : "0.01"
                                            }
                                            value={movementQuantity}
                                            onChange={(event) => {
                                                setMovementQuantity(
                                                    normalizeWesternDigits(
                                                        event.target.value,
                                                    ),
                                                );
                                                setMovementError("");
                                            }}
                                            placeholder="0"
                                            className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                                        />
                                    </label>
                                </div>

                                {selectedProduct && (
                                    <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                                        الكمية الحالية: {formatQuantity(selectedProduct.quantity)} {selectedProduct.unit}
                                    </p>
                                )}

                                <label className="grid gap-2">
                                    <span className="text-sm font-semibold">
                                        ملاحظة اختيارية
                                    </span>
                                    <textarea
                                        value={movementNote}
                                        onChange={(event) => {
                                            setMovementNote(event.target.value);
                                            setMovementError("");
                                        }}
                                        rows={3}
                                        placeholder="اكتب سبب الحركة أو أي تفاصيل إضافية"
                                        className="resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                                    />
                                </label>
                            </div>

                            {movementError && (
                                <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                                    {movementError}
                                </p>
                            )}

                            <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-5">
                                <button
                                    type="button"
                                    onClick={closeMovementDialog}
                                    className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                                >
                                    إلغاء
                                </button>
                                <button
                                    type="submit"
                                    className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
                                >
                                    حفظ الحركة
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </section>
    );
}

type MovementHistoryRowProps = {
    movement: StockMovement;
    product?: Product;
};

function MovementHistoryRow({
    movement,
    product,
}: MovementHistoryRowProps) {
    const unit = product?.unit ?? "";

    return (
        <tr className="transition hover:bg-slate-50">
            <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                {formatDateTime(movement.createdAt)}
            </td>
            <td className="px-5 py-4 font-medium">
                {product?.name ?? "منتج محذوف"}
            </td>
            <td className="px-5 py-4">
                {product?.code ?? "—"}
            </td>
            <td className="px-5 py-4">
                <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                    {movementTypeLabels[movement.type]}
                </span>
            </td>
            <td className="px-5 py-4 font-semibold">
                {formatQuantity(movement.quantity)} {unit}
            </td>
            <td className="px-5 py-4">
                {formatQuantity(movement.previousQuantity)} {unit}
            </td>
            <td className="px-5 py-4 font-semibold">
                {formatQuantity(movement.newQuantity)} {unit}
            </td>
            <td className="max-w-xs px-5 py-4 text-slate-600">
                {movement.note || "—"}
                {(movement.sourceType === "sale_invoice" ||
                    movement.sourceType ===
                        "sale_invoice_cancellation") &&
                    movement.sourceId !== null && (
                        <Link
                            to={`/sales/${movement.sourceId}`}
                            className="mt-1 block text-xs font-semibold text-blue-700 hover:underline"
                        >
                            {movement.sourceType === "sale_invoice"
                                ? "فاتورة بيع"
                                : "عكس مخزون بسبب إلغاء الفاتورة"}{" "}
                            {normalizeWesternDigits(
                                movement.sourceReference,
                            )}
                        </Link>
                    )}
            </td>
        </tr>
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
