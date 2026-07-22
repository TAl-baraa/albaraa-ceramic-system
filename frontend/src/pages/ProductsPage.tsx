import { Plus, Search, X } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";

/*
 * يحدد شكل بيانات المنتج داخل التطبيق.
 *
 * الوحدة لا يمكن أن تكون إلا مترًا مربعًا أو قطعة.
 * أسعار البيع والشراء مخزنة كأرقام لإجراء العمليات الحسابية عليها.
 */
type Product = {
    id: number;
    code: string;
    name: string;
    size: string;
    company: string;
    unit: "متر مربع" | "قطعة";
    sellPriceIqd: number;
    purchasePriceUsd: number;
    initialQuantity: number;
};

/*
 * منتجات مؤقتة لاختبار الواجهة.
 * ستأتي هذه البيانات لاحقًا من قاعدة البيانات.
 */
const initialProducts: Product[] = [
    {
        id: 1,
        code: "CER-001",
        name: "سيراميك رخامي أبيض",
        size: "60×60",
        company: "شركة النور",
        unit: "متر مربع",
        sellPriceIqd: 18000,
        purchasePriceUsd: 9.5,
        initialQuantity: 126.5,
    },
    {
        id: 2,
        code: "CER-002",
        name: "بورسلان رمادي",
        size: "120×60",
        company: "شركة الرافدين",
        unit: "متر مربع",
        sellPriceIqd: 25000,
        purchasePriceUsd: 13,
        initialQuantity: 14,
    },
];

function ProductsPage() {
    /*
     * قائمة المنتجات الحالية.
     * استخدام useState يسمح بإضافة منتجات جديدة وتحديث الجدول.
     */
    const [products, setProducts] = useState<Product[]>(initialProducts);

    // النص المكتوب داخل حقل البحث.
    const [searchTerm, setSearchTerm] = useState("");

    // تحدد هل نافذة إضافة المنتج مفتوحة أم مغلقة.
    const [isAddProductOpen, setIsAddProductOpen] = useState(false);

    // رسالة الخطأ التي تظهر داخل نموذج إضافة المنتج.
    const [formError, setFormError] = useState("");

    // حالات حقول نموذج إضافة المنتج.
    const [productCode, setProductCode] = useState("");
    const [productName, setProductName] = useState("");
    const [productSize, setProductSize] = useState("");
    const [productCompany, setProductCompany] = useState("");
    // الكمية التي يدخل بها المنتج إلى المخزون عند إنشائه.
    const [initialQuantity, setInitialQuantity] = useState("0");

    const [productUnit, setProductUnit] = useState<
        "متر مربع" | "قطعة"
    >("متر مربع");

    /*
     * حقول الأسعار مخزنة مؤقتًا كنصوص؛ لأن قيمة input تصل كنص.
     * نحولها إلى أرقام عند حفظ المنتج.
     */
    const [sellPriceIqd, setSellPriceIqd] = useState("");
    const [purchasePriceUsd, setPurchasePriceUsd] = useState("");

    /*
     * تفرغ جميع حقول النموذج وتعيدها إلى قيمها الابتدائية.
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
     * تغلق نافذة إضافة المنتج وتفرغ الحقول.
     * وضعناها في دالة مستقلة كي نستخدمها في عدة أزرار.
     */
    function closeAddProductDialog() {
        resetProductForm();
        setIsAddProductOpen(false);
    }

    /*
     * تتحقق من بيانات النموذج، ثم تضيف المنتج إلى القائمة.
     */
    function handleAddProduct(event: FormEvent<HTMLFormElement>) {
        // منع النموذج من إعادة تحميل الصفحة.
        event.preventDefault();

        /*
         * تنظيف القيم قبل فحصها وحفظها.
         * نحول الكود إلى أحرف كبيرة لتوحيد طريقة تخزين الأكواد.
         */
        const normalizedCode = productCode.trim().toUpperCase();
        const normalizedName = productName.trim();
        const normalizedSize = productSize.trim();
        const normalizedCompany = productCompany.trim();

        const numericSellPriceIqd = Number(sellPriceIqd);
        const numericPurchasePriceUsd = Number(purchasePriceUsd);
        const numericInitialQuantity = Number(initialQuantity);
        // التحقق من تعبئة جميع الحقول المطلوبة.
        if (
            !normalizedCode ||
            !normalizedName ||
            !normalizedSize ||
            !normalizedCompany ||
            !sellPriceIqd ||
            !purchasePriceUsd
        ) {
            setFormError("يرجى تعبئة جميع الحقول المطلوبة.");
            return;
        }

        /*
         * التحقق من أن الأسعار أرقام صحيحة أكبر من الصفر.
         * Number.isFinite يمنع القيم غير الرقمية وغير الصالحة.
         */
        if (
            !Number.isFinite(numericSellPriceIqd) ||
            !Number.isFinite(numericPurchasePriceUsd) ||
            numericSellPriceIqd <= 0 ||
            numericPurchasePriceUsd <= 0
        ) {
            setFormError("يجب أن تكون أسعار البيع والشراء أكبر من صفر.");
            return;
        }

        /*
 * الكمية الابتدائية اختيارية، لذلك يسمح بالصفر،
 * لكنها لا يمكن أن تكون سالبة أو قيمة غير رقمية.
 */
        if (
            !Number.isFinite(numericInitialQuantity) ||
            numericInitialQuantity < 0
        ) {
            setFormError("يجب أن تكون الكمية الابتدائية صفرًا أو رقمًا موجبًا.");
            return;
        }

        // التحقق من عدم وجود منتج آخر يحمل الكود نفسه.
        const codeAlreadyExists = products.some((product) => {
            return product.code.toUpperCase() === normalizedCode;
        });

        if (codeAlreadyExists) {
            setFormError("يوجد منتج آخر يحمل هذا الكود.");
            return;
        }

        // إنشاء المنتج الجديد من القيم المدخلة.
        const newProduct: Product = {
            /*
             * معرف مؤقت يعتمد على الوقت الحالي.
             * لاحقًا ستنشئ قاعدة البيانات المعرف الحقيقي.
             */
            id: Date.now(),
            code: normalizedCode,
            name: normalizedName,
            size: normalizedSize,
            company: normalizedCompany,
            unit: productUnit,
            initialQuantity: numericInitialQuantity,
            sellPriceIqd: numericSellPriceIqd,
            purchasePriceUsd: numericPurchasePriceUsd,
        };

        /*
         * نضيف المنتج الجديد في بداية المصفوفة
         * حتى يظهر مباشرة في أعلى الجدول.
         */
        setProducts((currentProducts) => [
            newProduct,
            ...currentProducts,
        ]);

        // إغلاق النافذة وتفريغ النموذج بعد نجاح الإضافة.
        closeAddProductDialog();
    }

    /*
     * تنظيف عبارة البحث مرة واحدة، ثم استخدامها أثناء التصفية.
     */
    const normalizedSearch = searchTerm.trim().toLowerCase();

    /*
     * تعرض المنتجات التي يحتوي كودها أو اسمها على عبارة البحث.
     * عند كون البحث فارغًا، تعرض جميع المنتجات.
     */
    const filteredProducts = products.filter((product) => {
        return (
            product.code.toLowerCase().includes(normalizedSearch) ||
            product.name.toLowerCase().includes(normalizedSearch)
        );
    });

    return (
        <section>
            {/* رأس الصفحة: العنوان وزر إضافة منتج */}
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h3 className="text-2xl font-bold">المنتجات</h3>

                    <p className="mt-1 text-sm text-slate-500">
                        إدارة منتجات السيراميك والأسعار والمعلومات الأساسية.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={() => setIsAddProductOpen(true)}
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
                            onChange={(event) => setSearchTerm(event.target.value)}
                            placeholder="ابحث بالكود أو اسم المنتج"
                            className="w-full rounded-xl border border-slate-200 py-3 pr-10 pl-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                        />
                    </div>
                </div>

                {/* جدول المنتجات */}
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[1000px] text-right text-sm">
                        <thead className="bg-slate-50 text-slate-600">
                            <tr>
                                <th className="px-5 py-4 font-semibold">الكود</th>
                                <th className="px-5 py-4 font-semibold">
                                    اسم المنتج
                                </th>
                                <th className="px-5 py-4 font-semibold">القياس</th>
                                <th className="px-5 py-4 font-semibold">الشركة</th>
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

                                    <td className="px-5 py-4">{product.name}</td>

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
                                        {product.initialQuantity.toLocaleString("ar-IQ")}{" "}
                                        <span className="font-normal text-slate-500">
                                            {product.unit}
                                        </span>
                                    </td>

                                    <td className="px-5 py-4 font-semibold">
                                        {product.sellPriceIqd.toLocaleString("ar-IQ")}{" "}
                                        د.ع
                                    </td>

                                    <td className="px-5 py-4 font-semibold">
                                        $
                                        {product.purchasePriceUsd.toLocaleString("en-US", {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                        })}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* تظهر عند عدم وجود نتائج مطابقة للبحث */}
                {filteredProducts.length === 0 && (
                    <div className="px-5 py-16 text-center">
                        <p className="font-semibold">لا توجد منتجات مطابقة</p>

                        <p className="mt-1 text-sm text-slate-500">
                            جرّب البحث بكود أو اسم مختلف.
                        </p>
                    </div>
                )}
            </div>

            {/* نافذة إضافة المنتج */}
            {isAddProductOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/*
           * خلفية النافذة.
           * الضغط عليها يغلق النافذة ويفرغ الحقول.
           */}
                    <button
                        type="button"
                        aria-label="إغلاق نافذة إضافة المنتج"
                        onClick={closeAddProductDialog}
                        className="absolute inset-0 bg-slate-950/50"
                    />

                    {/* المحتوى الفعلي للنافذة */}
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="add-product-title"
                        className="relative z-10 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-xl"
                    >
                        {/* رأس النافذة */}
                        <div className="flex items-center justify-between border-b border-slate-200 p-5">
                            <div>
                                <h4
                                    id="add-product-title"
                                    className="text-lg font-bold"
                                >
                                    إضافة منتج جديد
                                </h4>

                                <p className="mt-1 text-sm text-slate-500">
                                    أدخل المعلومات الأساسية للمنتج.
                                </p>
                            </div>

                            <button
                                type="button"
                                aria-label="إغلاق"
                                onClick={closeAddProductDialog}
                                className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* نموذج إضافة المنتج */}
                        <form onSubmit={handleAddProduct} className="p-5">
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
                                        <option value="متر مربع">متر مربع</option>
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
                                        step={productUnit === "متر مربع" ? "0.01" : "1"}
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

                            {/* رسالة التحقق من الحقول */}
                            {formError && (
                                <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                                    {formError}
                                </p>
                            )}

                            {/* أزرار النموذج */}
                            <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-5">
                                <button
                                    type="button"
                                    onClick={closeAddProductDialog}
                                    className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                                >
                                    إلغاء
                                </button>

                                <button
                                    type="submit"
                                    className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
                                >
                                    حفظ المنتج
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </section>
    );
}

export default ProductsPage;