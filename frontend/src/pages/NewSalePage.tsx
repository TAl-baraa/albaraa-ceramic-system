import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
    ArrowRight,
    Check,
    Save,
    Search,
    Trash2,
    X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useCustomers } from "../context/CustomersContext";
import { useProducts } from "../context/ProductsContext";
import { useSales } from "../context/SalesContext";
import type { Currency } from "../types/customer";
import type { Product } from "../types/product";
import type {
    SaleInvoice,
    SaleInvoiceItem,
} from "../types/sale";
import {
    calculateInvoiceTotals,
    calculateLineTotal,
    calculateSubtotal,
    generateNextInvoiceNumber,
    validateSaleQuantity,
} from "../utils/salesCalculations";

type EditorItem = SaleInvoiceItem & {
    quantityInput: string;
    unitPriceInput: string;
    quantityError: string;
    priceError: string;
};

type SaveMode = "stay" | "return";

function toDateTimeInput(isoDate: string) {
    const date = new Date(isoDate);
    const localDate = new Date(
        date.getTime() - date.getTimezoneOffset() * 60_000,
    );

    return localDate.toISOString().slice(0, 16);
}

function makeId(existingIds: number[]) {
    return Math.max(
        Date.now(),
        ...existingIds.map((id) => id + 1),
        1,
    );
}

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

function validateUnitPrice(
    value: string,
    currency: Currency,
): string {
    const price = Number(value);

    if (
        value.trim() === "" ||
        !Number.isFinite(price) ||
        price <= 0
    ) {
        return "يجب أن يكون سعر الوحدة أكبر من صفر.";
    }

    if (currency === "IQD" && !Number.isInteger(price)) {
        return "سعر الدينار العراقي يجب أن يكون عددًا صحيحًا.";
    }

    if (
        currency === "USD" &&
        !/^\d+(?:\.\d{1,2})?$/.test(value.trim())
    ) {
        return "سعر الدولار يقبل منزلتين عشريتين كحد أقصى.";
    }

    return "";
}

export function SaleInvoiceEditor({
    invoiceId,
}: {
    invoiceId?: number;
}) {
    const navigate = useNavigate();
    const { products } = useProducts();
    const { customers } = useCustomers();
    const {
        invoices,
        invoiceItems,
        getInvoiceById,
        getItemsByInvoiceId,
        saveDraftInvoice,
        completeDraftInvoice,
    } = useSales();
    const existingInvoice =
        invoiceId === undefined
            ? undefined
            : getInvoiceById(invoiceId);
    const invalidEdit =
        invoiceId !== undefined &&
        (!existingInvoice || existingInvoice.status !== "draft");
    const initialNow = useRef(new Date().toISOString()).current;
    const stableInvoiceId = useRef(
        existingInvoice?.id ??
            makeId(invoices.map((invoice) => invoice.id)),
    ).current;
    const stableInvoiceNumber = useRef(
        existingInvoice?.invoiceNumber ??
            generateNextInvoiceNumber(
                invoices,
                new Date().getFullYear(),
            ),
    ).current;

    const [dateValue, setDateValue] = useState(() =>
        toDateTimeInput(existingInvoice?.createdAt ?? initialNow),
    );
    const [customerId, setCustomerId] = useState<number | null>(
        existingInvoice?.customerId ?? null,
    );
    const [customerNameSnapshot, setCustomerNameSnapshot] =
        useState(
            existingInvoice?.customerNameSnapshot ?? "بيع نقدي",
        );
    const [currency, setCurrency] = useState<Currency>(
        existingInvoice?.currency ?? "IQD",
    );
    const [note, setNote] = useState(existingInvoice?.note ?? "");
    const [discountInput, setDiscountInput] = useState(
        existingInvoice?.discount.toString() ?? "0",
    );
    const [paidInput, setPaidInput] = useState(
        existingInvoice?.paidAmount.toString() ?? "0",
    );
    const [items, setItems] = useState<EditorItem[]>(() =>
        (existingInvoice
            ? getItemsByInvoiceId(existingInvoice.id)
            : []
        ).map((item) => ({
            ...item,
            quantityInput: item.quantity.toString(),
            unitPriceInput: item.unitPrice.toString(),
            quantityError: "",
            priceError: "",
        })),
    );
    const [customerSearch, setCustomerSearch] = useState("");
    const [productSearch, setProductSearch] = useState("");
    const [formError, setFormError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");
    const [showLeaveConfirmation, setShowLeaveConfirmation] =
        useState(false);
    const [pendingCurrency, setPendingCurrency] =
        useState<Currency | null>(null);
    const [showFinalizeConfirmation, setShowFinalizeConfirmation] =
        useState(false);

    const currentSignature = JSON.stringify({
        dateValue,
        customerId,
        customerNameSnapshot,
        currency,
        note,
        discountInput,
        paidInput,
        items: items.map(
            ({
                id,
                productId,
                quantityInput,
                unitPriceInput,
            }) => ({
                id,
                productId,
                quantityInput,
                unitPriceInput,
            }),
        ),
    });
    const initialSignature = useRef(currentSignature);
    const isDirty = currentSignature !== initialSignature.current;

    useEffect(() => {
        function handleBeforeUnload(event: BeforeUnloadEvent) {
            if (isDirty) {
                event.preventDefault();
            }
        }

        function handleInternalLink(event: MouseEvent) {
            if (!isDirty || event.defaultPrevented) {
                return;
            }

            const target = event.target;

            if (!(target instanceof Element)) {
                return;
            }

            const link = target.closest("a[href]");

            if (
                link instanceof HTMLAnchorElement &&
                new URL(link.href).origin === window.location.origin &&
                !window.confirm(
                    "لديك تغييرات غير محفوظة. هل تريد مغادرة الصفحة؟",
                )
            ) {
                event.preventDefault();
                event.stopPropagation();
            }
        }

        window.addEventListener("beforeunload", handleBeforeUnload);
        document.addEventListener("click", handleInternalLink, true);

        return () => {
            window.removeEventListener(
                "beforeunload",
                handleBeforeUnload,
            );
            document.removeEventListener(
                "click",
                handleInternalLink,
                true,
            );
        };
    }, [isDirty]);

    const subtotal = calculateSubtotal(
        items.map((item) => ({
            quantity: Number(item.quantityInput) || 0,
            unitPrice: Number(item.unitPriceInput) || 0,
        })),
    );
    const discount = Number(discountInput) || 0;
    const paidAmount = Number(paidInput) || 0;
    const totals = calculateInvoiceTotals(
        subtotal,
        discount,
        paidAmount,
    );
    const normalizedProductSearch = productSearch
        .trim()
        .toLowerCase();
    const matchingProducts = useMemo(
        () =>
            normalizedProductSearch
                ? products
                      .filter(
                          (product) =>
                              product.code
                                  .toLowerCase()
                                  .includes(
                                      normalizedProductSearch,
                                  ) ||
                              product.name
                                  .toLowerCase()
                                  .includes(
                                      normalizedProductSearch,
                                  ),
                      )
                      .slice(0, 8)
                : [],
        [normalizedProductSearch, products],
    );
    const normalizedCustomerSearch = customerSearch
        .trim()
        .toLowerCase();
    const matchingCustomers = normalizedCustomerSearch
        ? customers
              .filter(
                  (customer) =>
                      customer.name
                          .toLowerCase()
                          .includes(normalizedCustomerSearch) ||
                      customer.phone.includes(
                          normalizedCustomerSearch,
                      ),
              )
              .slice(0, 8)
        : [];

    if (invalidEdit) {
        return (
            <EditorError
                message={
                    existingInvoice
                        ? "لا يمكن تعديل فاتورة مكتملة أو ملغاة."
                        : "تعذر العثور على مسودة الفاتورة المطلوبة."
                }
                onBack={() => navigate("/sales")}
            />
        );
    }

    function selectCustomer(
        selectedCustomerId: number | null,
        snapshot: string,
    ) {
        setCustomerId(selectedCustomerId);
        setCustomerNameSnapshot(snapshot);
        setCustomerSearch("");
        setSuccessMessage("");
    }

    function addProduct(product: Product) {
        const existingItem = items.find(
            (item) => item.productId === product.id,
        );

        if (existingItem) {
            const nextQuantity =
                Number(existingItem.quantityInput) + 1;
            const quantityError =
                validateSaleQuantity(
                    nextQuantity,
                    product.unit,
                    product.quantity,
                ) ?? "";

            setItems((currentItems) =>
                currentItems.map((item) =>
                    item.productId === product.id
                        ? {
                              ...item,
                              quantity: nextQuantity,
                              quantityInput:
                                  nextQuantity.toString(),
                              quantityError,
                              total: calculateLineTotal(
                                  nextQuantity,
                                  Number(item.unitPriceInput) || 0,
                              ),
                          }
                        : item,
                ),
            );
        } else {
            const unitPrice =
                currency === "IQD" ? product.sellPriceIqd : 0;
            const itemId = makeId(
                invoiceItems
                    .map((item) => item.id)
                    .concat(items.map((item) => item.id)),
            );

            setItems((currentItems) => [
                ...currentItems,
                {
                    id: itemId,
                    invoiceId: stableInvoiceId,
                    productId: product.id,
                    productCodeSnapshot: product.code,
                    productNameSnapshot: product.name,
                    unit: product.unit,
                    quantity: 1,
                    unitPrice,
                    total: calculateLineTotal(1, unitPrice),
                    quantityInput: "1",
                    unitPriceInput:
                        unitPrice === 0
                            ? ""
                            : unitPrice.toString(),
                    quantityError:
                        validateSaleQuantity(
                            1,
                            product.unit,
                            product.quantity,
                        ) ?? "",
                    priceError:
                        currency === "USD"
                            ? "أدخل سعر البيع بالدولار يدويًا؛ لا يوجد سعر بيع بالدولار محفوظ."
                            : "",
                },
            ]);
        }

        setProductSearch("");
        setFormError("");
        setSuccessMessage("");
    }

    function updateItemQuantity(itemId: number, value: string) {
        setItems((currentItems) =>
            currentItems.map((item) => {
                if (item.id !== itemId) {
                    return item;
                }

                const product = products.find(
                    (currentProduct) =>
                        currentProduct.id === item.productId,
                );
                const quantity = Number(value);
                const quantityError = product
                    ? validateSaleQuantity(
                          quantity,
                          item.unit,
                          product.quantity,
                      ) ?? ""
                    : "المنتج غير موجود في المخزون الحالي.";

                return {
                    ...item,
                    quantity,
                    quantityInput: value,
                    quantityError,
                    total: calculateLineTotal(
                        Number.isFinite(quantity) ? quantity : 0,
                        Number(item.unitPriceInput) || 0,
                    ),
                };
            }),
        );
        setSuccessMessage("");
    }

    function updateItemPrice(itemId: number, value: string) {
        setItems((currentItems) =>
            currentItems.map((item) => {
                if (item.id !== itemId) {
                    return item;
                }

                const unitPrice = Number(value);
                const priceError = validateUnitPrice(
                    value,
                    currency,
                );

                return {
                    ...item,
                    unitPrice,
                    unitPriceInput: value,
                    priceError,
                    total: calculateLineTotal(
                        Number(item.quantityInput) || 0,
                        Number.isFinite(unitPrice) ? unitPrice : 0,
                    ),
                };
            }),
        );
        setSuccessMessage("");
    }

    function requestCurrencyChange(nextCurrency: Currency) {
        if (nextCurrency === currency) {
            return;
        }

        if (items.length > 0) {
            setPendingCurrency(nextCurrency);
            return;
        }

        setCurrency(nextCurrency);
    }

    function applyCurrencyChange() {
        if (!pendingCurrency) {
            return;
        }

        setCurrency(pendingCurrency);
        setItems((currentItems) =>
            currentItems.map((item) => ({
                ...item,
                priceError: validateUnitPrice(
                    item.unitPriceInput,
                    pendingCurrency,
                ),
            })),
        );
        setPendingCurrency(null);
        setSuccessMessage("");
    }

    function validateForm() {
        if (!dateValue || !Number.isFinite(Date.parse(dateValue))) {
            setFormError("تاريخ الفاتورة مطلوب.");
            return false;
        }

        if (items.length === 0) {
            setFormError("يجب إضافة منتج واحد على الأقل.");
            return false;
        }

        let hasItemError = false;
        const validatedItems = items.map((item) => {
            const product = products.find(
                (currentProduct) =>
                    currentProduct.id === item.productId,
            );
            const quantityError = product
                ? validateSaleQuantity(
                      Number(item.quantityInput),
                      item.unit,
                      product.quantity,
                  ) ?? ""
                : "المنتج غير موجود في المخزون الحالي.";
            const priceError = validateUnitPrice(
                item.unitPriceInput,
                currency,
            );

            if (quantityError || priceError) {
                hasItemError = true;
            }

            return { ...item, quantityError, priceError };
        });

        setItems(validatedItems);

        if (hasItemError) {
            setFormError("يرجى تصحيح بيانات منتجات الفاتورة.");
            return false;
        }

        if (
            discountInput.trim() === "" ||
            !Number.isFinite(Number(discountInput)) ||
            Number(discountInput) < 0
        ) {
            setFormError("يجب ألا يكون الخصم رقمًا سالبًا.");
            return false;
        }

        if (Number(discountInput) > subtotal) {
            setFormError("لا يمكن أن يتجاوز الخصم المجموع الفرعي.");
            return false;
        }

        if (
            paidInput.trim() === "" ||
            !Number.isFinite(Number(paidInput)) ||
            Number(paidInput) < 0
        ) {
            setFormError("يجب ألا يكون المبلغ المدفوع سالبًا.");
            return false;
        }

        setFormError("");
        return true;
    }

    function saveDraft(mode: SaveMode) {
        if (!validateForm()) {
            return;
        }

        const now = new Date().toISOString();
        const invoice: SaleInvoice = {
            id: stableInvoiceId,
            invoiceNumber: stableInvoiceNumber,
            customerId,
            customerNameSnapshot,
            currency,
            status: "draft",
            subtotal: totals.subtotal,
            discount: totals.discount,
            total: totals.total,
            paidAmount: totals.paidAmount,
            remainingAmount: totals.remainingAmount,
            note: note.trim(),
            createdAt: new Date(dateValue).toISOString(),
            updatedAt: now,
            completedAt: null,
            completionTransactionId: null,
            stockMovementIds: [],
            cancelledAt: null,
            cancellationReason: "",
            reversalStockMovementIds: [],
            reversedCustomerTransactionId: null,
        };
        const savedItems: SaleInvoiceItem[] = items.map((item) => {
            const quantity = Number(item.quantityInput);
            const unitPrice = Number(item.unitPriceInput);

            return {
                id: item.id,
                invoiceId: stableInvoiceId,
                productId: item.productId,
                productCodeSnapshot: item.productCodeSnapshot,
                productNameSnapshot: item.productNameSnapshot,
                unit: item.unit,
                quantity,
                unitPrice,
                total: calculateLineTotal(quantity, unitPrice),
            };
        });
        const result = saveDraftInvoice(invoice, savedItems);

        if (!result.success) {
            setFormError(result.error);
            return;
        }

        initialSignature.current = currentSignature;

        if (mode === "return") {
            navigate("/sales");
            return;
        }

        setSuccessMessage("تم حفظ مسودة الفاتورة بنجاح.");
        setFormError("");
    }

    function requestCancel() {
        if (isDirty) {
            setShowLeaveConfirmation(true);
        } else {
            navigate("/sales");
        }
    }

    function requestFinalization() {
        if (isDirty) {
            setFormError(
                "احفظ تغييرات المسودة قبل اعتماد الفاتورة.",
            );
            return;
        }

        if (
            !invoices.some(
                (invoice) =>
                    invoice.id === stableInvoiceId &&
                    invoice.status === "draft",
            )
        ) {
            setFormError("احفظ الفاتورة كمسودة قبل اعتمادها.");
            return;
        }

        setShowFinalizeConfirmation(true);
    }

    function finalizeInvoice() {
        const result = completeDraftInvoice(stableInvoiceId);

        if (!result.success) {
            setFormError(result.error);
            setShowFinalizeConfirmation(false);
            return;
        }

        navigate(`/sales/${stableInvoiceId}?completed=1`);
    }

    return (
        <section className="mx-auto max-w-[1500px] pb-24">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <button
                        type="button"
                        onClick={requestCancel}
                        className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
                    >
                        <ArrowRight size={18} />
                        العودة إلى المبيعات
                    </button>
                    <h3 className="text-2xl font-bold">
                        {existingInvoice
                            ? "تعديل مسودة فاتورة البيع"
                            : "فاتورة بيع جديدة"}
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                        أضف معلومات الفاتورة والمنتجات ثم احفظها كمسودة.
                    </p>
                </div>
                <span
                    className="self-start rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white"
                    dir="ltr"
                >
                    {stableInvoiceNumber}
                </span>
            </div>

            {successMessage && (
                <div className="mb-5 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                    <Check size={18} />
                    {successMessage}
                </div>
            )}
            {formError && (
                <div className="mb-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                    {formError}
                </div>
            )}

            <div className="grid gap-6">
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h4 className="mb-5 text-lg font-bold">
                        معلومات الفاتورة
                    </h4>
                    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                        <Field label="رقم الفاتورة">
                            <input
                                value={stableInvoiceNumber}
                                readOnly
                                dir="ltr"
                                className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-600"
                            />
                        </Field>
                        <Field label="التاريخ">
                            <input
                                type="datetime-local"
                                value={dateValue}
                                onChange={(event) => {
                                    setDateValue(event.target.value);
                                    setSuccessMessage("");
                                }}
                                className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
                                required
                            />
                        </Field>
                        <div className="md:col-span-2">
                            <p className="mb-2 text-sm font-semibold">
                                العملة
                            </p>
                            <CurrencyToggle
                                value={currency}
                                onChange={requestCurrencyChange}
                            />
                        </div>
                        <div className="relative md:col-span-2">
                            <p className="mb-2 text-sm font-semibold">
                                العميل
                            </p>
                            <div className="rounded-xl border border-slate-200 p-3">
                                <p className="font-semibold">
                                    {customerNameSnapshot}
                                </p>
                                {customerId !== null && (
                                    <p className="mt-1 text-xs text-slate-500">
                                        {
                                            customers.find(
                                                (customer) =>
                                                    customer.id ===
                                                    customerId,
                                            )?.phone
                                        }
                                    </p>
                                )}
                            </div>
                            <div className="relative mt-2">
                                <Search
                                    size={17}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                                />
                                <input
                                    value={customerSearch}
                                    onChange={(event) =>
                                        setCustomerSearch(
                                            event.target.value,
                                        )
                                    }
                                    placeholder="ابحث باسم العميل أو الهاتف"
                                    className="w-full rounded-xl border border-slate-200 py-2.5 pr-9 pl-3 text-sm outline-none focus:border-slate-400"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={() =>
                                    selectCustomer(null, "بيع نقدي")
                                }
                                className="mt-2 w-full rounded-lg bg-slate-100 px-3 py-2 text-right text-sm font-semibold hover:bg-slate-200"
                            >
                                بيع نقدي - بدون عميل
                            </button>
                            {matchingCustomers.length > 0 && (
                                <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                                    {matchingCustomers.map((customer) => (
                                        <button
                                            key={customer.id}
                                            type="button"
                                            onClick={() =>
                                                selectCustomer(
                                                    customer.id,
                                                    customer.name,
                                                )
                                            }
                                            className="flex w-full items-center justify-between border-b border-slate-100 px-4 py-3 text-right text-sm last:border-0 hover:bg-slate-50"
                                        >
                                            <span className="font-semibold">
                                                {customer.name}
                                            </span>
                                            <span
                                                className="text-slate-500"
                                                dir="ltr"
                                            >
                                                {customer.phone || "—"}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <Field
                            label="ملاحظات"
                            className="md:col-span-2"
                        >
                            <textarea
                                value={note}
                                onChange={(event) => {
                                    setNote(event.target.value);
                                    setSuccessMessage("");
                                }}
                                rows={5}
                                className="resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
                            />
                        </Field>
                    </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h4 className="text-lg font-bold">إضافة المنتجات</h4>
                    <p className="mt-1 text-sm text-slate-500">
                        ابحث بكود المنتج أو اسمه ثم اختره لإضافته.
                    </p>
                    {currency === "USD" && (
                        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
                            لا يوجد سعر بيع بالدولار محفوظ للمنتجات. أدخل
                            سعر الوحدة بالدولار يدويًا دون تحويل تلقائي.
                        </p>
                    )}
                    <div className="relative mt-4 max-w-2xl">
                        <Search
                            size={19}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                        />
                        <input
                            value={productSearch}
                            onChange={(event) =>
                                setProductSearch(event.target.value)
                            }
                            placeholder="ابحث بالكود أو اسم المنتج"
                            className="w-full rounded-xl border border-slate-200 py-3 pr-10 pl-4 text-sm outline-none focus:border-slate-400"
                        />
                        {matchingProducts.length > 0 && (
                            <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                                {matchingProducts.map((product) => (
                                    <button
                                        key={product.id}
                                        type="button"
                                        onClick={() => addProduct(product)}
                                        className="grid w-full gap-2 border-b border-slate-100 px-4 py-3 text-right text-sm last:border-0 hover:bg-slate-50 sm:grid-cols-[1fr_auto]"
                                    >
                                        <span>
                                            <span className="font-bold">
                                                {product.code} —{" "}
                                                {product.name}
                                            </span>
                                            <span className="mt-1 block text-xs text-slate-500">
                                                {product.size} •{" "}
                                                {product.company} • المتوفر{" "}
                                                {product.quantity.toLocaleString(
                                                    "ar-IQ",
                                                )}{" "}
                                                {product.unit}
                                            </span>
                                        </span>
                                        <span className="font-semibold">
                                            {currency === "IQD"
                                                ? formatMoney(
                                                      product.sellPriceIqd,
                                                      "IQD",
                                                  )
                                                : "سعر يدوي"}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </section>

                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-200 p-5">
                        <h4 className="text-lg font-bold">
                            منتجات الفاتورة
                        </h4>
                    </div>
                    {items.length === 0 ? (
                        <div className="p-12 text-center text-sm text-slate-500">
                            لم تتم إضافة منتجات إلى الفاتورة بعد.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[1100px] text-right text-sm">
                                <thead className="bg-slate-50 text-slate-600">
                                    <tr>
                                        <th className="px-4 py-3">
                                            الكود
                                        </th>
                                        <th className="px-4 py-3">
                                            المنتج
                                        </th>
                                        <th className="px-4 py-3">
                                            الوحدة
                                        </th>
                                        <th className="px-4 py-3">
                                            المتوفر
                                        </th>
                                        <th className="px-4 py-3">
                                            الكمية
                                        </th>
                                        <th className="px-4 py-3">
                                            سعر الوحدة
                                        </th>
                                        <th className="px-4 py-3">
                                            الإجمالي
                                        </th>
                                        <th className="px-4 py-3">
                                            الإجراءات
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {items.map((item) => {
                                        const product = products.find(
                                            (currentProduct) =>
                                                currentProduct.id ===
                                                item.productId,
                                        );

                                        return (
                                            <tr key={item.id}>
                                                <td
                                                    className="px-4 py-4 font-semibold"
                                                    dir="ltr"
                                                >
                                                    {
                                                        item.productCodeSnapshot
                                                    }
                                                </td>
                                                <td className="px-4 py-4">
                                                    {
                                                        item.productNameSnapshot
                                                    }
                                                </td>
                                                <td className="px-4 py-4">
                                                    {item.unit}
                                                </td>
                                                <td className="px-4 py-4">
                                                    {product
                                                        ? product.quantity.toLocaleString(
                                                              "ar-IQ",
                                                          )
                                                        : "غير متوفر"}
                                                </td>
                                                <td className="w-48 px-4 py-4 align-top">
                                                    <input
                                                        type="number"
                                                        min="0.01"
                                                        step={
                                                            item.unit ===
                                                            "قطعة"
                                                                ? "1"
                                                                : "0.01"
                                                        }
                                                        value={
                                                            item.quantityInput
                                                        }
                                                        onChange={(event) =>
                                                            updateItemQuantity(
                                                                item.id,
                                                                event.target
                                                                    .value,
                                                            )
                                                        }
                                                        className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-slate-400"
                                                    />
                                                    {item.quantityError && (
                                                        <p className="mt-1 text-xs text-red-600">
                                                            {
                                                                item.quantityError
                                                            }
                                                        </p>
                                                    )}
                                                </td>
                                                <td className="w-56 px-4 py-4 align-top">
                                                    <input
                                                        type="number"
                                                        min="0.01"
                                                        step={
                                                            currency ===
                                                            "USD"
                                                                ? "0.01"
                                                                : "1"
                                                        }
                                                        value={
                                                            item.unitPriceInput
                                                        }
                                                        onChange={(event) =>
                                                            updateItemPrice(
                                                                item.id,
                                                                event.target
                                                                    .value,
                                                            )
                                                        }
                                                        placeholder={
                                                            currency ===
                                                            "USD"
                                                                ? "أدخل سعر USD"
                                                                : ""
                                                        }
                                                        className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-slate-400"
                                                    />
                                                    {item.priceError && (
                                                        <p className="mt-1 text-xs text-red-600">
                                                            {item.priceError}
                                                        </p>
                                                    )}
                                                </td>
                                                <td className="whitespace-nowrap px-4 py-4 font-bold">
                                                    {formatMoney(
                                                        calculateLineTotal(
                                                            Number(
                                                                item.quantityInput,
                                                            ) || 0,
                                                            Number(
                                                                item.unitPriceInput,
                                                            ) || 0,
                                                        ),
                                                        currency,
                                                    )}
                                                </td>
                                                <td className="px-4 py-4">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setItems(
                                                                (
                                                                    currentItems,
                                                                ) =>
                                                                    currentItems.filter(
                                                                        (
                                                                            currentItem,
                                                                        ) =>
                                                                            currentItem.id !==
                                                                            item.id,
                                                                    ),
                                                            );
                                                            setSuccessMessage(
                                                                "",
                                                            );
                                                        }}
                                                        aria-label="حذف المنتج"
                                                        className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h4 className="mb-5 text-lg font-bold">
                        المبالغ والمدفوعات
                    </h4>
                    <div className="grid gap-6 lg:grid-cols-2">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <Field label="الخصم">
                                <input
                                    type="number"
                                    min="0"
                                    step={
                                        currency === "USD" ? "0.01" : "1"
                                    }
                                    value={discountInput}
                                    onChange={(event) => {
                                        setDiscountInput(
                                            event.target.value,
                                        );
                                        setSuccessMessage("");
                                    }}
                                    className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
                                />
                            </Field>
                            <Field label="المدفوع">
                                <input
                                    type="number"
                                    min="0"
                                    step={
                                        currency === "USD" ? "0.01" : "1"
                                    }
                                    value={paidInput}
                                    onChange={(event) => {
                                        setPaidInput(event.target.value);
                                        setSuccessMessage("");
                                    }}
                                    className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
                                />
                            </Field>
                        </div>
                        <div className="space-y-3 rounded-xl bg-slate-50 p-4">
                            <TotalRow
                                label="المجموع الفرعي"
                                value={formatMoney(
                                    totals.subtotal,
                                    currency,
                                )}
                            />
                            <TotalRow
                                label="الخصم"
                                value={formatMoney(
                                    totals.discount,
                                    currency,
                                )}
                            />
                            <TotalRow
                                label="الإجمالي النهائي"
                                value={formatMoney(
                                    totals.total,
                                    currency,
                                )}
                                strong
                            />
                            <TotalRow
                                label="المدفوع"
                                value={formatMoney(
                                    totals.paidAmount,
                                    currency,
                                )}
                            />
                            <TotalRow
                                label="المتبقي"
                                value={formatMoney(
                                    totals.remainingAmount,
                                    currency,
                                )}
                                strong
                            />
                            {totals.overpayment > 0 && (
                                <div className="rounded-lg bg-blue-50 px-3 py-2 text-blue-700">
                                    <p className="text-xs font-semibold">
                                        مبلغ زائد للعميل
                                    </p>
                                    <p className="mt-1 font-bold">
                                        {formatMoney(
                                            totals.overpayment,
                                            currency,
                                        )}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </section>
            </div>

            <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 p-3 backdrop-blur lg:right-72">
                <div className="mx-auto flex max-w-[1500px] flex-wrap justify-end gap-2">
                    <button
                        type="button"
                        onClick={requestCancel}
                        className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold hover:bg-slate-100"
                    >
                        إلغاء
                    </button>
                    <button
                        type="button"
                        onClick={() => saveDraft("stay")}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-100"
                    >
                        <Save size={17} />
                        حفظ كمسودة
                    </button>
                    <button
                        type="button"
                        onClick={() => saveDraft("return")}
                        className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
                    >
                        <Check size={17} />
                        حفظ والعودة للمبيعات
                    </button>
                    <button
                        type="button"
                        onClick={requestFinalization}
                        className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
                    >
                        اعتماد الفاتورة
                    </button>
                </div>
            </div>

            {pendingCurrency && (
                <ConfirmationDialog
                    title="تغيير عملة الفاتورة"
                    message="لن يتم تحويل أو تعديل أسعار المنتجات الحالية تلقائيًا. يجب مراجعة أسعار الوحدة بعد تغيير العملة."
                    confirmLabel="تغيير العملة"
                    onClose={() => setPendingCurrency(null)}
                    onConfirm={applyCurrencyChange}
                />
            )}

            {showLeaveConfirmation && (
                <ConfirmationDialog
                    title="تغييرات غير محفوظة"
                    message="لديك تغييرات غير محفوظة. هل تريد مغادرة محرر الفاتورة؟"
                    confirmLabel="مغادرة الصفحة"
                    onClose={() => setShowLeaveConfirmation(false)}
                    onConfirm={() => navigate("/sales")}
                    destructive
                />
            )}

            {showFinalizeConfirmation && (
                <FinalizeInvoiceDialog
                    invoiceNumber={stableInvoiceNumber}
                    customerName={customerNameSnapshot}
                    currency={currency}
                    total={totals.total}
                    paidAmount={totals.paidAmount}
                    remainingAmount={totals.remainingAmount}
                    itemCount={items.length}
                    onClose={() =>
                        setShowFinalizeConfirmation(false)
                    }
                    onConfirm={finalizeInvoice}
                />
            )}
        </section>
    );
}

export function FinalizeInvoiceDialog({
    invoiceNumber,
    customerName,
    currency,
    total,
    paidAmount,
    remainingAmount,
    itemCount,
    onClose,
    onConfirm,
}: {
    invoiceNumber: string;
    customerName: string;
    currency: Currency;
    total: number;
    paidAmount: number;
    remainingAmount: number;
    itemCount: number;
    onClose: () => void;
    onConfirm: () => void;
}) {
    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <button
                type="button"
                onClick={onClose}
                className="fixed inset-0 bg-slate-950/70"
                aria-label="إغلاق"
            />
            <div className="relative z-[111] w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h4 className="text-lg font-bold">
                            اعتماد فاتورة البيع
                        </h4>
                        <p className="mt-1 text-sm text-slate-500" dir="ltr">
                            {invoiceNumber}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="إغلاق"
                    >
                        <X size={19} />
                    </button>
                </div>
                <div className="mt-5 grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
                    <TotalRow label="العميل" value={customerName} />
                    <TotalRow label="العملة" value={currency} />
                    <TotalRow
                        label="الإجمالي"
                        value={formatMoney(total, currency)}
                    />
                    <TotalRow
                        label="المدفوع"
                        value={formatMoney(paidAmount, currency)}
                    />
                    <TotalRow
                        label={
                            remainingAmount < 0
                                ? "المبلغ الزائد"
                                : "المتبقي"
                        }
                        value={formatMoney(
                            Math.abs(remainingAmount),
                            currency,
                        )}
                    />
                    <TotalRow
                        label="عدد المنتجات"
                        value={itemCount.toLocaleString("ar-IQ")}
                    />
                </div>
                {remainingAmount < 0 && (
                    <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
                        يوجد مبلغ زائد مدفوع على الفاتورة.
                    </p>
                )}
                <div className="mt-4 space-y-2 text-sm leading-6 text-red-700">
                    <p>سيتم خصم كميات المنتجات من المخزون.</p>
                    <p>
                        لا يمكن تعديل الفاتورة بعد اعتمادها.
                    </p>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold"
                    >
                        تراجع
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white"
                    >
                        اعتماد الفاتورة
                    </button>
                </div>
            </div>
        </div>
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
        <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1">
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
                    className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                        value === currency
                            ? "bg-white shadow-sm"
                            : "text-slate-500"
                    }`}
                >
                    {label}
                </button>
            ))}
        </div>
    );
}

function Field({
    label,
    className = "",
    children,
}: {
    label: string;
    className?: string;
    children: ReactNode;
}) {
    return (
        <label className={`grid gap-2 ${className}`}>
            <span className="text-sm font-semibold">{label}</span>
            {children}
        </label>
    );
}

function TotalRow({
    label,
    value,
    strong = false,
}: {
    label: string;
    value: string;
    strong?: boolean;
}) {
    return (
        <div
            className={`flex items-center justify-between gap-3 ${
                strong ? "text-base font-bold" : "text-sm"
            }`}
        >
            <span className="text-slate-600">{label}</span>
            <span>{value}</span>
        </div>
    );
}

function ConfirmationDialog({
    title,
    message,
    confirmLabel,
    onClose,
    onConfirm,
    destructive = false,
}: {
    title: string;
    message: string;
    confirmLabel: string;
    onClose: () => void;
    onConfirm: () => void;
    destructive?: boolean;
}) {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <button
                type="button"
                onClick={onClose}
                className="fixed inset-0 bg-slate-950/60"
                aria-label="إغلاق"
            />
            <div className="relative z-[101] w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h4 className="text-lg font-bold">{title}</h4>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                            {message}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="إغلاق"
                    >
                        <X size={19} />
                    </button>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold"
                    >
                        تراجع
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className={`rounded-xl px-4 py-2.5 text-sm font-semibold text-white ${
                            destructive
                                ? "bg-red-600"
                                : "bg-slate-900"
                        }`}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}

function EditorError({
    message,
    onBack,
}: {
    message: string;
    onBack: () => void;
}) {
    return (
        <section className="mx-auto max-w-2xl rounded-2xl border border-red-100 bg-white p-8 text-center shadow-sm">
            <h3 className="text-xl font-bold text-red-700">
                تعذر تعديل الفاتورة
            </h3>
            <p className="mt-2 text-sm text-slate-600">{message}</p>
            <button
                type="button"
                onClick={onBack}
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"
            >
                <ArrowRight size={18} />
                العودة إلى المبيعات
            </button>
        </section>
    );
}

function NewSalePage() {
    return <SaleInvoiceEditor />;
}

export default NewSalePage;
