import {
    Pencil,
    Plus,
    Search,
    Trash2,
    X,
} from "lucide-react";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useSearchParams } from "react-router-dom";

import { useProducts } from "../context/ProductsContext";
import type {
    Product,
    ProductUnit,
} from "../types/product";
import {
    formatCurrency,
    formatQuantity,
    normalizeWesternDigits,
} from "../utils/formatters";

function ProductsPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const {
        products,
        addProduct,
        updateProduct,
        deleteProduct,
    } = useProducts();

    const [searchTerm, setSearchTerm] = useState("");

    const [isProductDialogOpen, setIsProductDialogOpen] =
        useState(false);

    const [productToEdit, setProductToEdit] =
        useState<Product | null>(null);

    const [productToDelete, setProductToDelete] =
        useState<Product | null>(null);

    const [formError, setFormError] = useState("");

    const [productCode, setProductCode] = useState("");
    const [productName, setProductName] = useState("");
    const [productSize, setProductSize] = useState("");
    const [productCompany, setProductCompany] = useState("");

    const [productUnit, setProductUnit] =
        useState<ProductUnit>("متر مربع");

    const [quantity, setQuantity] = useState("0");
    const [minimumQuantity, setMinimumQuantity] =
        useState("0");

    const [sellPriceIqd, setSellPriceIqd] = useState("");
    const [purchasePriceUsd, setPurchasePriceUsd] =
        useState("");

    function resetProductForm() {
        setProductCode("");
        setProductName("");
        setProductSize("");
        setProductCompany("");
        setProductUnit("متر مربع");
        setQuantity("0");
        setMinimumQuantity("0");
        setSellPriceIqd("");
        setPurchasePriceUsd("");
        setFormError("");
    }

    function openAddProductDialog() {
        setProductToEdit(null);
        resetProductForm();
        setIsProductDialogOpen(true);
    }

    useEffect(() => {
        if (searchParams.get("action") !== "add") {
            return;
        }
        openAddProductDialog();
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete("action");
        setSearchParams(nextParams, { replace: true });
    }, [searchParams, setSearchParams]);

    function openEditProductDialog(product: Product) {
        setProductToEdit(product);

        setProductCode(product.code);
        setProductName(product.name);
        setProductSize(normalizeWesternDigits(product.size));
        setProductCompany(product.company);
        setProductUnit(product.unit);
        setQuantity(product.quantity.toString());
        setMinimumQuantity(
            product.minimumQuantity.toString(),
        );
        setSellPriceIqd(product.sellPriceIqd.toString());
        setPurchasePriceUsd(
            product.purchasePriceUsd.toString(),
        );

        setFormError("");
        setIsProductDialogOpen(true);
    }

    function closeProductDialog() {
        setIsProductDialogOpen(false);
        setProductToEdit(null);
        resetProductForm();
    }

    function handleDeleteProduct() {
        if (!productToDelete) {
            return;
        }

        deleteProduct(productToDelete.id);
        setProductToDelete(null);
    }

    function handleProductSubmit(
        event: FormEvent<HTMLFormElement>,
    ) {
        event.preventDefault();

        const normalizedCode =
            productCode.trim().toUpperCase();

        const normalizedName = productName.trim();
        const normalizedSize = productSize.trim();
        const normalizedCompany = productCompany.trim();

        const numericQuantity = Number(quantity);

        const numericMinimumQuantity =
            Number(minimumQuantity);

        const numericSellPriceIqd =
            Number(sellPriceIqd);

        const numericPurchasePriceUsd =
            Number(purchasePriceUsd);

        if (
            !normalizedCode ||
            !normalizedName ||
            !normalizedSize ||
            !normalizedCompany ||
            sellPriceIqd.trim() === "" ||
            purchasePriceUsd.trim() === ""
        ) {
            setFormError(
                "يرجى تعبئة جميع الحقول المطلوبة.",
            );
            return;
        }

        if (
            !Number.isFinite(numericSellPriceIqd) ||
            !Number.isFinite(numericPurchasePriceUsd) ||
            numericSellPriceIqd <= 0 ||
            numericPurchasePriceUsd <= 0
        ) {
            setFormError(
                "يجب أن تكون أسعار البيع والشراء أكبر من صفر.",
            );
            return;
        }

        if (
            !Number.isFinite(numericQuantity) ||
            numericQuantity < 0
        ) {
            setFormError(
                "يجب أن تكون الكمية صفرًا أو رقمًا موجبًا.",
            );
            return;
        }

        if (
            !Number.isFinite(numericMinimumQuantity) ||
            numericMinimumQuantity < 0
        ) {
            setFormError(
                "يجب أن يكون الحد الأدنى صفرًا أو رقمًا موجبًا.",
            );
            return;
        }

        if (
            productUnit === "قطعة" &&
            (!Number.isInteger(numericQuantity) ||
                !Number.isInteger(numericMinimumQuantity))
        ) {
            setFormError(
                "كميات المنتجات المقاسة بالقطعة يجب أن تكون أعدادًا صحيحة.",
            );
            return;
        }

        const codeAlreadyExists = products.some(
            (product) => {
                const hasSameCode =
                    product.code.toUpperCase() === normalizedCode;

                const isDifferentProduct =
                    product.id !== productToEdit?.id;

                return hasSameCode && isDifferentProduct;
            },
        );

        if (codeAlreadyExists) {
            setFormError(
                "يوجد منتج آخر يحمل هذا الكود.",
            );
            return;
        }

        const productData: Omit<Product, "id"> = {
            code: normalizedCode,
            name: normalizedName,
            size: normalizedSize,
            company: normalizedCompany,
            unit: productUnit,
            quantity: numericQuantity,
            minimumQuantity: numericMinimumQuantity,
            sellPriceIqd: numericSellPriceIqd,
            purchasePriceUsd: numericPurchasePriceUsd,
        };

        if (productToEdit) {
            updateProduct({
                id: productToEdit.id,
                ...productData,
            });
        } else {
            addProduct({
                id: Date.now(),
                ...productData,
            });
        }

        closeProductDialog();
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

    return (
        <section>
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h3 className="text-2xl font-bold">
                        المنتجات
                    </h3>

                    <p className="mt-1 text-sm text-slate-500">
                        إدارة منتجات السيراميك والأسعار والمعلومات
                        الأساسية.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={openAddProductDialog}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
                >
                    <Plus size={18} />
                    <span>إضافة منتج</span>
                </button>
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
                    <table className="w-full min-w-[1150px] text-right text-sm">
                        <thead className="bg-slate-50 text-slate-600">
                            <tr>
                                <th className="px-5 py-4 font-semibold">
                                    الكود
                                </th>

                                <th className="px-5 py-4 font-semibold">
                                    اسم المنتج
                                </th>

                                <th className="px-5 py-4 font-semibold">
                                    القياس
                                </th>

                                <th className="px-5 py-4 font-semibold">
                                    الشركة
                                </th>

                                <th className="px-5 py-4 font-semibold">
                                    الوحدة
                                </th>

                                <th className="px-5 py-4 font-semibold">
                                    الكمية
                                </th>

                                <th className="px-5 py-4 font-semibold">
                                    سعر البيع
                                </th>

                                <th className="px-5 py-4 font-semibold">
                                    سعر الشراء
                                </th>

                                <th className="px-5 py-4 font-semibold">
                                    الإجراءات
                                </th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-100">
                            {filteredProducts.map((product) => (
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

                                    <td className="px-5 py-4 text-slate-600">
                                        {normalizeWesternDigits(product.size)}
                                    </td>

                                    <td className="px-5 py-4 text-slate-600">
                                        {product.company}
                                    </td>

                                    <td className="px-5 py-4 text-slate-600">
                                        {product.unit}
                                    </td>

                                    <td className="px-5 py-4 font-semibold">
                                        {formatQuantity(product.quantity)}{" "}
                                        <span className="font-normal text-slate-500">
                                            {product.unit}
                                        </span>
                                    </td>

                                    <td className="px-5 py-4 font-semibold">
                                        {formatCurrency(
                                            product.sellPriceIqd,
                                            "IQD",
                                        )}
                                    </td>

                                    <td className="px-5 py-4 font-semibold">
                                        {formatCurrency(
                                            product.purchasePriceUsd,
                                            "USD",
                                        )}
                                    </td>

                                    <td className="px-5 py-4">
                                        <div className="flex gap-1">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    openEditProductDialog(product)
                                                }
                                                className="rounded-lg p-2 text-blue-600 transition hover:bg-blue-50"
                                                title="تعديل المنتج"
                                                aria-label={`تعديل المنتج ${product.name}`}
                                            >
                                                <Pencil size={18} />
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setProductToDelete(product)
                                                }
                                                className="rounded-lg p-2 text-red-600 transition hover:bg-red-50"
                                                title="حذف المنتج"
                                                aria-label={`حذف المنتج ${product.name}`}
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {filteredProducts.length === 0 && (
                    <div className="px-5 py-16 text-center">
                        <p className="font-semibold">
                            لا توجد منتجات مطابقة
                        </p>
                    </div>
                )}
            </div>

            {isProductDialogOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <button
                        type="button"
                        aria-label="إغلاق نافذة المنتج"
                        onClick={closeProductDialog}
                        className="absolute inset-0 bg-slate-950/50"
                    />

                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="product-dialog-title"
                        className="relative z-10 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-xl"
                    >
                        <div className="flex items-center justify-between border-b border-slate-200 p-5">
                            <div>
                                <h4
                                    id="product-dialog-title"
                                    className="text-lg font-bold"
                                >
                                    {productToEdit
                                        ? "تعديل المنتج"
                                        : "إضافة منتج جديد"}
                                </h4>

                                <p className="mt-1 text-sm text-slate-500">
                                    {productToEdit
                                        ? "عدّل المعلومات المطلوبة ثم احفظ التغييرات."
                                        : "أدخل المعلومات الأساسية للمنتج."}
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={closeProductDialog}
                                aria-label="إغلاق"
                                className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form
                            onSubmit={handleProductSubmit}
                            className="p-5"
                        >
                            <div className="grid gap-5 md:grid-cols-2">
                                <label className="grid gap-2">
                                    <span className="text-sm font-semibold">
                                        كود المنتج
                                    </span>

                                    <input
                                        type="text"
                                        value={productCode}
                                        onChange={(event) => {
                                            setProductCode(event.target.value);
                                            setFormError("");
                                        }}
                                        autoFocus
                                        placeholder="مثال: CER-001"
                                        className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                                    />
                                </label>

                                <label className="grid gap-2">
                                    <span className="text-sm font-semibold">
                                        اسم المنتج
                                    </span>

                                    <input
                                        type="text"
                                        value={productName}
                                        onChange={(event) => {
                                            setProductName(event.target.value);
                                            setFormError("");
                                        }}
                                        placeholder="اكتب اسم المنتج"
                                        className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                                    />
                                </label>

                                <label className="grid gap-2">
                                    <span className="text-sm font-semibold">
                                        القياس
                                    </span>

                                    <input
                                        type="text"
                                        value={productSize}
                                        onChange={(event) => {
                                            setProductSize(
                                                normalizeWesternDigits(
                                                    event.target.value,
                                                ),
                                            );
                                            setFormError("");
                                        }}
                                        placeholder="مثال: 60×60"
                                        className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                                    />
                                </label>

                                <label className="grid gap-2">
                                    <span className="text-sm font-semibold">
                                        الشركة
                                    </span>

                                    <input
                                        type="text"
                                        value={productCompany}
                                        onChange={(event) => {
                                            setProductCompany(event.target.value);
                                            setFormError("");
                                        }}
                                        placeholder="اسم الشركة"
                                        className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                                    />
                                </label>

                                <label className="grid gap-2">
                                    <span className="text-sm font-semibold">
                                        وحدة المخزون
                                    </span>

                                    <select
                                        value={productUnit}
                                        onChange={(event) => {
                                            setProductUnit(
                                                event.target.value as ProductUnit,
                                            );
                                            setFormError("");
                                        }}
                                        className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                                    >
                                        <option value="متر مربع">
                                            متر مربع
                                        </option>

                                        <option value="قطعة">قطعة</option>
                                    </select>
                                </label>

                                <label className="grid gap-2">
                                    <span className="text-sm font-semibold">
                                        الكمية الابتدائية
                                    </span>

                                    <input
                                        type="number"
                                        lang="en"
                                        min="0"
                                        step={
                                            productUnit === "قطعة" ? "1" : "0.01"
                                        }
                                        value={quantity}
                                        onChange={(event) => {
                                            setQuantity(
                                                normalizeWesternDigits(
                                                    event.target.value,
                                                ),
                                            );
                                            setFormError("");
                                        }}
                                        className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none"
                                    />
                                </label>

                                <label className="grid gap-2">
                                    <span className="text-sm font-semibold">
                                        الحد الأدنى للمخزون
                                    </span>

                                    <input
                                        type="number"
                                        lang="en"
                                        min="0"
                                        step={
                                            productUnit === "قطعة" ? "1" : "0.01"
                                        }
                                        value={minimumQuantity}
                                        onChange={(event) => {
                                            setMinimumQuantity(
                                                normalizeWesternDigits(
                                                    event.target.value,
                                                ),
                                            );
                                            setFormError("");
                                        }}
                                        className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none"
                                    />
                                </label>

                                <label className="grid gap-2">
                                    <span className="text-sm font-semibold">
                                        سعر البيع بالدينار
                                    </span>

                                    <input
                                        type="number"
                                        lang="en"
                                        min="0"
                                        step="1"
                                        value={sellPriceIqd}
                                        onChange={(event) => {
                                            setSellPriceIqd(
                                                normalizeWesternDigits(
                                                    event.target.value,
                                                ),
                                            );
                                            setFormError("");
                                        }}
                                        className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none"
                                    />
                                </label>

                                <label className="grid gap-2">
                                    <span className="text-sm font-semibold">
                                        سعر الشراء بالدولار
                                    </span>

                                    <input
                                        type="number"
                                        lang="en"
                                        min="0"
                                        step="0.01"
                                        value={purchasePriceUsd}
                                        onChange={(event) => {
                                            setPurchasePriceUsd(
                                                normalizeWesternDigits(
                                                    event.target.value,
                                                ),
                                            );
                                            setFormError("");
                                        }}
                                        className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none"
                                    />
                                </label>
                            </div>

                            {formError && (
                                <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                                    {formError}
                                </p>
                            )}

                            <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-5">
                                <button
                                    type="button"
                                    onClick={closeProductDialog}
                                    className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold"
                                >
                                    إلغاء
                                </button>

                                <button
                                    type="submit"
                                    className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"
                                >
                                    {productToEdit
                                        ? "حفظ التعديلات"
                                        : "حفظ المنتج"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {productToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <button
                        type="button"
                        onClick={() => setProductToDelete(null)}
                        aria-label="إغلاق نافذة الحذف"
                        className="absolute inset-0 bg-slate-950/50"
                    />

                    <div className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-xl">
                        <div className="border-b border-slate-200 p-5">
                            <h4 className="text-lg font-bold text-red-700">
                                حذف المنتج
                            </h4>

                            <p className="mt-2 text-sm text-slate-600">
                                هل أنت متأكد من حذف{" "}
                                <strong>{productToDelete.name}</strong>؟
                            </p>
                        </div>

                        <div className="flex justify-end gap-3 p-5">
                            <button
                                type="button"
                                onClick={() =>
                                    setProductToDelete(null)
                                }
                                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold"
                            >
                                إلغاء
                            </button>

                            <button
                                type="button"
                                onClick={handleDeleteProduct}
                                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white"
                            >
                                <Trash2 size={17} />
                                تأكيد الحذف
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}

export default ProductsPage;
