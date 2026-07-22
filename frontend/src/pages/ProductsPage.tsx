import { Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";

/*
 * شكل بيانات المنتج داخل التطبيق.
 *
 * initialQuantity تمثل الرصيد الافتتاحي المؤقت.
 * لاحقًا ستتحول في قاعدة البيانات إلى حركة مخزون افتتاحية.
 */
type Product = {
    id: number;
    code: string;
    name: string;
    size: string;
    company: string;
    unit: "متر مربع" | "قطعة";
    initialQuantity: number;
    sellPriceIqd: number;
    purchasePriceUsd: number;
};

/*
 * بيانات مؤقتة لاختبار الواجهة.
 * ستأتي المنتجات لاحقًا من الخادم وقاعدة البيانات.
 */
const initialProducts: Product[] = [
    {
        id: 1,
        code: "CER-001",
        name: "سيراميك رخامي أبيض",
        size: "60×60",
        company: "شركة النور",
        unit: "متر مربع",
        initialQuantity: 126.5,
        sellPriceIqd: 18000,
        purchasePriceUsd: 9.5,
    },
    {
        id: 2,
        code: "CER-002",
        name: "بورسلان رمادي",
        size: "120×60",
        company: "شركة الرافدين",
        unit: "متر مربع",
        initialQuantity: 14,
        sellPriceIqd: 25000,
        purchasePriceUsd: 13,
    },
];

function ProductsPage() {
    // قائمة المنتجات المعروضة حاليًا.
    const [products, setProducts] =
        useState<Product[]>(initialProducts);

    // النص المكتوب في حقل البحث.
    const [searchTerm, setSearchTerm] = useState("");

    // تحدد ظهور نافذة إضافة أو تعديل المنتج.
    const [isProductDialogOpen, setIsProductDialogOpen] =
        useState(false);

    /*
     * إذا كانت القيمة null فنحن في وضع الإضافة.
     * وجود منتج يعني أننا في وضع تعديل ذلك المنتج.
     */
    const [productToEdit, setProductToEdit] =
        useState<Product | null>(null);

    /*
     * المنتج المحدد للحذف.
     * null تعني أن نافذة تأكيد الحذف مغلقة.
     */
    const [productToDelete, setProductToDelete] =
        useState<Product | null>(null);

    // رسالة التحقق التي تظهر أسفل حقول النموذج.
    const [formError, setFormError] = useState("");

    // حالات حقول نموذج المنتج.
    const [productCode, setProductCode] = useState("");
    const [productName, setProductName] = useState("");
    const [productSize, setProductSize] = useState("");
    const [productCompany, setProductCompany] = useState("");

    const [productUnit, setProductUnit] = useState<
        "متر مربع" | "قطعة"
    >("متر مربع");

    /*
     * قيم حقول الأرقام تحفظ كنصوص أثناء الكتابة؛
     * لأن عناصر input تعيد event.target.value كنص.
     */
    const [initialQuantity, setInitialQuantity] = useState("0");
    const [sellPriceIqd, setSellPriceIqd] = useState("");
    const [purchasePriceUsd, setPurchasePriceUsd] = useState("");

    /*
     * تفريغ حقول النموذج وإعادتها إلى قيمها الافتراضية.
     */
    function resetProductForm() {
        setProductCode("");
        setProductName("");
        setProductSize("");
        setProductCompany("");
        setProductUnit("متر مربع");
        setInitialQuantity("0");
        setSellPriceIqd("");
        setPurchasePriceUsd("");
        setFormError("");
    }

    /*
     * فتح النافذة في وضع إضافة منتج جديد.
     */
    function openAddProductDialog() {
        setProductToEdit(null);
        resetProductForm();
        setIsProductDialogOpen(true);
    }

    /*
     * فتح النافذة في وضع التعديل ونسخ بيانات المنتج
     * المحدد إلى حقول النموذج.
     */
    function openEditProductDialog(product: Product) {
        setProductToEdit(product);

        setProductCode(product.code);
        setProductName(product.name);
        setProductSize(product.size);
        setProductCompany(product.company);
        setProductUnit(product.unit);
        setInitialQuantity(product.initialQuantity.toString());
        setSellPriceIqd(product.sellPriceIqd.toString());
        setPurchasePriceUsd(product.purchasePriceUsd.toString());

        setFormError("");
        setIsProductDialogOpen(true);
    }

    /*
     * إغلاق نافذة المنتج وإعادتها إلى وضع الإضافة.
     */
    function closeProductDialog() {
        setIsProductDialogOpen(false);
        setProductToEdit(null);
        resetProductForm();
    }

    /*
     * حذف المنتج المحدد من القائمة.
     */
    function handleDeleteProduct() {
        if (!productToDelete) {
            return;
        }

        setProducts((currentProducts) => {
            return currentProducts.filter((product) => {
                return product.id !== productToDelete.id;
            });
        });

        setProductToDelete(null);
    }

    /*
     * التحقق من حقول النموذج ثم إضافة المنتج أو تعديله.
     */
    function handleProductSubmit(
        event: FormEvent<HTMLFormElement>,
    ) {
        // منع المتصفح من إعادة تحميل الصفحة عند إرسال النموذج.
        event.preventDefault();

        // تنظيف النصوص قبل التحقق والحفظ.
        const normalizedCode = productCode.trim().toUpperCase();
        const normalizedName = productName.trim();
        const normalizedSize = productSize.trim();
        const normalizedCompany = productCompany.trim();

        // تحويل قيم الحقول الرقمية من نصوص إلى أرقام.
        const numericInitialQuantity = Number(initialQuantity);
        const numericSellPriceIqd = Number(sellPriceIqd);
        const numericPurchasePriceUsd = Number(purchasePriceUsd);

        // التحقق من تعبئة الحقول المطلوبة.
        if (
            !normalizedCode ||
            !normalizedName ||
            !normalizedSize ||
            !normalizedCompany ||
            sellPriceIqd.trim() === "" ||
            purchasePriceUsd.trim() === ""
        ) {
            setFormError("يرجى تعبئة جميع الحقول المطلوبة.");
            return;
        }

        // التحقق من صحة أسعار البيع والشراء.
        if (
            !Number.isFinite(numericSellPriceIqd) ||
            !Number.isFinite(numericPurchasePriceUsd) ||
            numericSellPriceIqd <= 0 ||
            numericPurchasePriceUsd <= 0
        ) {
            setFormError(
                "يجب أن تكون أسعار البيع والشراء أرقامًا أكبر من صفر.",
            );
            return;
        }

        /*
         * الكمية الافتتاحية يمكن أن تكون صفرًا،
         * لكنها لا يمكن أن تكون سالبة.
         */
        if (
            !Number.isFinite(numericInitialQuantity) ||
            numericInitialQuantity < 0
        ) {
            setFormError(
                "يجب أن تكون الكمية الابتدائية صفرًا أو رقمًا موجبًا.",
            );
            return;
        }

        /*
         * المنتجات التي تقاس بالقطعة يجب أن تحتوي
         * على عدد صحيح، ولا يجوز إدخال نصف قطعة.
         */
        if (
            productUnit === "قطعة" &&
            !Number.isInteger(numericInitialQuantity)
        ) {
            setFormError(
                "يجب أن تكون كمية المنتجات المقاسة بالقطعة عددًا صحيحًا.",
            );
            return;
        }

        /*
         * البحث عن منتج آخر يحمل الكود نفسه.
         *
         * عند التعديل نستثني المنتج الجاري تعديله،
         * حتى يستطيع الاحتفاظ بكوده الحالي.
         */
        const codeAlreadyExists = products.some((product) => {
            const hasSameCode =
                product.code.toUpperCase() === normalizedCode;

            const isDifferentProduct =
                product.id !== productToEdit?.id;

            return hasSameCode && isDifferentProduct;
        });

        if (codeAlreadyExists) {
            setFormError("يوجد منتج آخر يحمل هذا الكود.");
            return;
        }

        /*
         * البيانات المشتركة بين عمليتي الإضافة والتعديل.
         * لا تحتوي على id لأن المعرف يعالج بصورة مختلفة
         * في كل عملية.
         */
        const productData: Omit<Product, "id"> = {
            code: normalizedCode,
            name: normalizedName,
            size: normalizedSize,
            company: normalizedCompany,
            unit: productUnit,
            initialQuantity: numericInitialQuantity,
            sellPriceIqd: numericSellPriceIqd,
            purchasePriceUsd: numericPurchasePriceUsd,
        };

        if (productToEdit) {
            /*
             * وضع التعديل:
             * نستبدل بيانات المنتج الذي يملك المعرف نفسه،
             * ونترك بقية المنتجات دون تغيير.
             */
            setProducts((currentProducts) => {
                return currentProducts.map((product) => {
                    if (product.id === productToEdit.id) {
                        return {
                            id: product.id,
                            ...productData,
                        };
                    }

                    return product;
                });
            });
        } else {
            /*
             * وضع الإضافة:
             * ننشئ معرفًا مؤقتًا ونضيف المنتج أعلى الجدول.
             */
            const newProduct: Product = {
                id: Date.now(),
                ...productData,
            };

            setProducts((currentProducts) => [
                newProduct,
                ...currentProducts,
            ]);
        }

        closeProductDialog();
    }

    // تنظيف نص البحث لتسهيل المقارنة.
    const normalizedSearch = searchTerm.trim().toLowerCase();

    /*
     * تصفية المنتجات حسب الكود أو الاسم.
     * إذا كان حقل البحث فارغًا فستظهر جميع المنتجات.
     */
    const filteredProducts = products.filter((product) => {
        return (
            product.code.toLowerCase().includes(normalizedSearch) ||
            product.name.toLowerCase().includes(normalizedSearch)
        );
    });

    return (
        <section>
            {/* رأس صفحة المنتجات */}
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h3 className="text-2xl font-bold">المنتجات</h3>

                    <p className="mt-1 text-sm text-slate-500">
                        إدارة منتجات السيراميك والأسعار والمعلومات الأساسية.
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
                {/* حقل البحث */}
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

                {/* جدول المنتجات */}
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[1100px] text-right text-sm">
                        <thead className="bg-slate-50 text-slate-600">
                            <tr>
                                <th className="px-5 py-4 font-semibold">الكود</th>

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
                                    وحدة المخزون
                                </th>

                                <th className="px-5 py-4 font-semibold">
                                    الكمية الابتدائية
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
                                        {product.size}
                                    </td>

                                    <td className="px-5 py-4 text-slate-600">
                                        {product.company}
                                    </td>

                                    <td className="px-5 py-4 text-slate-600">
                                        {product.unit}
                                    </td>

                                    <td className="px-5 py-4 font-semibold">
                                        {product.initialQuantity.toLocaleString(
                                            "ar-IQ",
                                        )}{" "}
                                        <span className="font-normal text-slate-500">
                                            {product.unit}
                                        </span>
                                    </td>

                                    <td className="px-5 py-4 font-semibold">
                                        {product.sellPriceIqd.toLocaleString(
                                            "ar-IQ",
                                        )}{" "}
                                        د.ع
                                    </td>

                                    <td className="px-5 py-4 font-semibold">
                                        $
                                        {product.purchasePriceUsd.toLocaleString(
                                            "en-US",
                                            {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                            },
                                        )}
                                    </td>

                                    <td className="px-5 py-4">
                                        <div className="flex items-center gap-1">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    openEditProductDialog(product)
                                                }
                                                className="inline-flex items-center justify-center rounded-lg p-2 text-blue-600 transition hover:bg-blue-50 hover:text-blue-700"
                                                aria-label={`تعديل المنتج ${product.name}`}
                                                title="تعديل المنتج"
                                            >
                                                <Pencil size={18} />
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setProductToDelete(product)
                                                }
                                                className="inline-flex items-center justify-center rounded-lg p-2 text-red-600 transition hover:bg-red-50 hover:text-red-700"
                                                aria-label={`حذف المنتج ${product.name}`}
                                                title="حذف المنتج"
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

                {/* حالة عدم وجود نتائج */}
                {filteredProducts.length === 0 && (
                    <div className="px-5 py-16 text-center">
                        <p className="font-semibold">
                            لا توجد منتجات مطابقة
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                            جرّب البحث بكود أو اسم مختلف.
                        </p>
                    </div>
                )}
            </div>

            {/* نافذة إضافة أو تعديل المنتج */}
            {isProductDialogOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* الخلفية المعتمة */}
                    <button
                        type="button"
                        aria-label="إغلاق نافذة المنتج"
                        onClick={closeProductDialog}
                        className="absolute inset-0 bg-slate-950/50"
                    />

                    {/* محتوى النافذة */}
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="product-dialog-title"
                        className="relative z-10 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-xl"
                    >
                        {/* رأس النافذة */}
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
                                aria-label="إغلاق"
                                onClick={closeProductDialog}
                                className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* نموذج المنتج */}
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
                                        placeholder="مثال: CER-001"
                                        autoFocus
                                        className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
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
                                        className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
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
                                            setProductSize(event.target.value);
                                            setFormError("");
                                        }}
                                        placeholder="مثال: 60×60"
                                        className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
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
                                        placeholder="اكتب اسم الشركة"
                                        className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
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
                                                event.target.value as
                                                | "متر مربع"
                                                | "قطعة",
                                            );

                                            setFormError("");
                                        }}
                                        className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
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
                                        min="0"
                                        step={
                                            productUnit === "متر مربع"
                                                ? "0.01"
                                                : "1"
                                        }
                                        value={initialQuantity}
                                        onChange={(event) => {
                                            setInitialQuantity(event.target.value);
                                            setFormError("");
                                        }}
                                        placeholder="0"
                                        className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                                    />

                                    <span className="text-xs text-slate-500">
                                        أدخل صفرًا إذا لم تصل البضاعة بعد.
                                    </span>
                                </label>

                                <label className="grid gap-2">
                                    <span className="text-sm font-semibold">
                                        سعر البيع بالدينار
                                    </span>

                                    <input
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={sellPriceIqd}
                                        onChange={(event) => {
                                            setSellPriceIqd(event.target.value);
                                            setFormError("");
                                        }}
                                        placeholder="0"
                                        className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                                    />
                                </label>

                                <label className="grid gap-2">
                                    <span className="text-sm font-semibold">
                                        سعر الشراء بالدولار
                                    </span>

                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={purchasePriceUsd}
                                        onChange={(event) => {
                                            setPurchasePriceUsd(event.target.value);
                                            setFormError("");
                                        }}
                                        placeholder="0.00"
                                        className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                                    />
                                </label>
                            </div>

                            {/* رسالة التحقق */}
                            {formError && (
                                <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                                    {formError}
                                </p>
                            )}

                            {/* أزرار النموذج */}
                            <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-5">
                                <button
                                    type="button"
                                    onClick={closeProductDialog}
                                    className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                                >
                                    إلغاء
                                </button>

                                <button
                                    type="submit"
                                    className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
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

            {/* نافذة تأكيد الحذف */}
            {productToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <button
                        type="button"
                        aria-label="إغلاق نافذة تأكيد الحذف"
                        onClick={() => setProductToDelete(null)}
                        className="absolute inset-0 bg-slate-950/50"
                    />

                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="delete-product-title"
                        className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-xl"
                    >
                        <div className="border-b border-slate-200 p-5">
                            <h4
                                id="delete-product-title"
                                className="text-lg font-bold text-red-700"
                            >
                                حذف المنتج
                            </h4>

                            <p className="mt-2 text-sm leading-6 text-slate-600">
                                هل أنت متأكد من حذف المنتج{" "}
                                <span className="font-bold text-slate-900">
                                    {productToDelete.name}
                                </span>
                                ؟
                            </p>

                            <p className="mt-1 text-sm text-slate-500">
                                الكود: {productToDelete.code}
                            </p>
                        </div>

                        <div className="flex justify-end gap-3 p-5">
                            <button
                                type="button"
                                onClick={() => setProductToDelete(null)}
                                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                            >
                                إلغاء
                            </button>

                            <button
                                type="button"
                                onClick={handleDeleteProduct}
                                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700"
                            >
                                <Trash2 size={17} />
                                <span>تأكيد الحذف</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}

export default ProductsPage;