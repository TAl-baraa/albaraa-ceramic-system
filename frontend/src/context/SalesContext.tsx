import {
    createContext,
    useContext,
    useEffect,
    useRef,
    useState,
} from "react";
import type { ReactNode } from "react";

import {
    initialSaleInvoiceItems,
    initialSaleInvoices,
} from "../data/initialSales";
import { buildSaleCancellationPlan } from "../services/saleCancellation";
import { buildSaleCompletionPlan } from "../services/saleCompletion";
import type {
    SaleInvoice,
    SaleInvoiceItem,
    SaleInvoiceStatus,
} from "../types/sale";
import { useCustomers } from "./CustomersContext";
import { useProducts } from "./ProductsContext";

const SALES_INVOICES_STORAGE_KEY =
    "albaraa-ceramic-sale-invoices";
const SALES_ITEMS_STORAGE_KEY =
    "albaraa-ceramic-sale-invoice-items";

type SalesActionResult =
    | { success: true }
    | { success: false; error: string };

type SalesContextValue = {
    invoices: SaleInvoice[];
    invoiceItems: SaleInvoiceItem[];
    addInvoice: (
        invoice: SaleInvoice,
        items?: SaleInvoiceItem[],
    ) => SalesActionResult;
    updateInvoice: (
        invoice: SaleInvoice,
        items?: SaleInvoiceItem[],
    ) => SalesActionResult;
    saveDraftInvoice: (
        invoice: SaleInvoice,
        items: SaleInvoiceItem[],
    ) => SalesActionResult;
    deleteDraftInvoice: (invoiceId: number) => SalesActionResult;
    completeDraftInvoice: (invoiceId: number) => SalesActionResult;
    cancelCompletedInvoice: (
        invoiceId: number,
        reason: string,
    ) => SalesActionResult;
    getInvoiceById: (invoiceId: number) => SaleInvoice | undefined;
    getItemsByInvoiceId: (invoiceId: number) => SaleInvoiceItem[];
};

const SalesContext = createContext<SalesContextValue | null>(null);

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function isNonNegativeFiniteNumber(value: unknown): value is number {
    return (
        typeof value === "number" &&
        Number.isFinite(value) &&
        value >= 0
    );
}

function isPositiveFiniteNumber(value: unknown): value is number {
    return (
        typeof value === "number" &&
        Number.isFinite(value) &&
        value > 0
    );
}

function isFiniteNumber(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value);
}

function isStatus(value: unknown): value is SaleInvoiceStatus {
    return (
        value === "draft" ||
        value === "completed" ||
        value === "cancelled"
    );
}

function isDate(value: unknown): value is string {
    return (
        typeof value === "string" &&
        Number.isFinite(Date.parse(value))
    );
}

function parseInvoice(value: unknown): SaleInvoice | null {
    if (!isRecord(value)) {
        return null;
    }

    if (
        !isNonNegativeFiniteNumber(value.id) ||
        typeof value.invoiceNumber !== "string" ||
        !(
            value.customerId === null ||
            isNonNegativeFiniteNumber(value.customerId)
        ) ||
        typeof value.customerNameSnapshot !== "string" ||
        !(value.currency === "IQD" || value.currency === "USD") ||
        !isStatus(value.status) ||
        !isNonNegativeFiniteNumber(value.subtotal) ||
        !isNonNegativeFiniteNumber(value.discount) ||
        !isNonNegativeFiniteNumber(value.total) ||
        !isNonNegativeFiniteNumber(value.paidAmount) ||
        !isFiniteNumber(value.remainingAmount) ||
        typeof value.note !== "string" ||
        !isDate(value.createdAt) ||
        !isDate(value.updatedAt)
    ) {
        return null;
    }

    return {
        id: value.id,
        invoiceNumber: value.invoiceNumber,
        customerId: value.customerId,
        customerNameSnapshot: value.customerNameSnapshot,
        currency: value.currency,
        status: value.status,
        subtotal: value.subtotal,
        discount: value.discount,
        total: value.total,
        paidAmount: value.paidAmount,
        remainingAmount: value.remainingAmount,
        note: value.note,
        createdAt: value.createdAt,
        updatedAt: value.updatedAt,
        completedAt: isDate(value.completedAt)
            ? value.completedAt
            : null,
        completionTransactionId: isNonNegativeFiniteNumber(
            value.completionTransactionId,
        )
            ? value.completionTransactionId
            : null,
        stockMovementIds: Array.isArray(value.stockMovementIds)
            ? value.stockMovementIds.filter(
                  (id): id is number =>
                      isNonNegativeFiniteNumber(id),
              )
            : [],
        cancelledAt: isDate(value.cancelledAt)
            ? value.cancelledAt
            : null,
        cancellationReason:
            typeof value.cancellationReason === "string"
                ? value.cancellationReason
                : "",
        reversalStockMovementIds: Array.isArray(
            value.reversalStockMovementIds,
        )
            ? value.reversalStockMovementIds.filter(
                  (id): id is number =>
                      isNonNegativeFiniteNumber(id),
              )
            : [],
        reversedCustomerTransactionId:
            isNonNegativeFiniteNumber(
                value.reversedCustomerTransactionId,
            )
                ? value.reversedCustomerTransactionId
                : null,
    };
}

function parseInvoiceItem(value: unknown): SaleInvoiceItem | null {
    if (!isRecord(value)) {
        return null;
    }

    if (
        !isNonNegativeFiniteNumber(value.id) ||
        !isNonNegativeFiniteNumber(value.invoiceId) ||
        !isNonNegativeFiniteNumber(value.productId) ||
        typeof value.productCodeSnapshot !== "string" ||
        typeof value.productNameSnapshot !== "string" ||
        !(value.unit === "متر مربع" || value.unit === "قطعة") ||
        !isPositiveFiniteNumber(value.quantity) ||
        !isNonNegativeFiniteNumber(value.unitPrice) ||
        !isNonNegativeFiniteNumber(value.total)
    ) {
        return null;
    }

    return {
        id: value.id,
        invoiceId: value.invoiceId,
        productId: value.productId,
        productCodeSnapshot: value.productCodeSnapshot,
        productNameSnapshot: value.productNameSnapshot,
        unit: value.unit,
        quantity: value.quantity,
        unitPrice: value.unitPrice,
        total: value.total,
    };
}

function loadStoredArray<T>(
    key: string,
    parser: (value: unknown) => T | null,
    fallback: readonly T[],
): T[] {
    try {
        const stored = localStorage.getItem(key);

        if (!stored) {
            return [...fallback];
        }

        const parsed: unknown = JSON.parse(stored);

        if (!Array.isArray(parsed) || parsed.length === 0) {
            return [...fallback];
        }

        const validItems = parsed
            .map(parser)
            .filter((item): item is T => item !== null);

        return validItems.length === parsed.length
            ? validItems
            : [...fallback];
    } catch {
        return [...fallback];
    }
}

export function SalesProvider({ children }: { children: ReactNode }) {
    const completionLocks = useRef(new Set<number>());
    const cancellationLocks = useRef(new Set<number>());
    const {
        products,
        stockMovements,
        applySaleStockPlan,
    } = useProducts();
    const {
        customers,
        transactions,
        applySaleTransaction,
        applySaleTransactionVoid,
    } = useCustomers();
    const [invoices, setInvoices] = useState<SaleInvoice[]>(() =>
        loadStoredArray(
            SALES_INVOICES_STORAGE_KEY,
            parseInvoice,
            initialSaleInvoices,
        ),
    );
    const [invoiceItems, setInvoiceItems] = useState<
        SaleInvoiceItem[]
    >(() =>
        loadStoredArray(
            SALES_ITEMS_STORAGE_KEY,
            parseInvoiceItem,
            initialSaleInvoiceItems,
        ),
    );

    useEffect(() => {
        try {
            localStorage.setItem(
                SALES_INVOICES_STORAGE_KEY,
                JSON.stringify(invoices),
            );
        } catch {
            // Keep sales usable in memory if browser storage is unavailable.
        }
    }, [invoices]);

    useEffect(() => {
        try {
            localStorage.setItem(
                SALES_ITEMS_STORAGE_KEY,
                JSON.stringify(invoiceItems),
            );
        } catch {
            // Keep sales usable in memory if browser storage is unavailable.
        }
    }, [invoiceItems]);

    function addInvoice(
        invoice: SaleInvoice,
        items: SaleInvoiceItem[] = [],
    ): SalesActionResult {
        if (
            invoices.some(
                (currentInvoice) =>
                    currentInvoice.id === invoice.id ||
                    currentInvoice.invoiceNumber ===
                        invoice.invoiceNumber,
            )
        ) {
            return {
                success: false,
                error: "رقم الفاتورة مستخدم بالفعل.",
            };
        }

        setInvoices((currentInvoices) => [
            invoice,
            ...currentInvoices,
        ]);
        setInvoiceItems((currentItems) => [
            ...currentItems,
            ...items,
        ]);
        return { success: true };
    }

    function updateInvoice(
        invoice: SaleInvoice,
        items?: SaleInvoiceItem[],
    ): SalesActionResult {
        if (
            !invoices.some(
                (currentInvoice) =>
                    currentInvoice.id === invoice.id,
            )
        ) {
            return { success: false, error: "الفاتورة غير موجودة." };
        }

        setInvoices((currentInvoices) =>
            currentInvoices.map((currentInvoice) =>
                currentInvoice.id === invoice.id
                    ? invoice
                    : currentInvoice,
            ),
        );

        if (items) {
            setInvoiceItems((currentItems) => [
                ...currentItems.filter(
                    (item) => item.invoiceId !== invoice.id,
                ),
                ...items,
            ]);
        }

        return { success: true };
    }

    function deleteDraftInvoice(
        invoiceId: number,
    ): SalesActionResult {
        const invoice = invoices.find(
            (currentInvoice) => currentInvoice.id === invoiceId,
        );

        if (!invoice) {
            return { success: false, error: "الفاتورة غير موجودة." };
        }

        if (invoice.status !== "draft") {
            return {
                success: false,
                error: "يمكن حذف الفواتير المسودة فقط.",
            };
        }

        setInvoices((currentInvoices) =>
            currentInvoices.filter(
                (currentInvoice) =>
                    currentInvoice.id !== invoiceId,
            ),
        );
        setInvoiceItems((currentItems) =>
            currentItems.filter(
                (item) => item.invoiceId !== invoiceId,
            ),
        );
        return { success: true };
    }

    function saveDraftInvoice(
        invoice: SaleInvoice,
        items: SaleInvoiceItem[],
    ): SalesActionResult {
        const existingInvoice = invoices.find(
            (currentInvoice) =>
                currentInvoice.id === invoice.id,
        );

        if (
            existingInvoice &&
            existingInvoice.status !== "draft"
        ) {
            return {
                success: false,
                error: "لا يمكن تعديل فاتورة غير مسودة.",
            };
        }

        if (invoice.status !== "draft") {
            return {
                success: false,
                error: "يجب حفظ الفاتورة كمسودة.",
            };
        }

        if (
            invoices.some(
                (currentInvoice) =>
                    currentInvoice.id !== invoice.id &&
                    currentInvoice.invoiceNumber ===
                        invoice.invoiceNumber,
            )
        ) {
            return {
                success: false,
                error: "رقم الفاتورة مستخدم بالفعل.",
            };
        }

        if (items.length === 0) {
            return {
                success: false,
                error: "يجب إضافة منتج واحد على الأقل.",
            };
        }

        const consistentItems = items.map((item) => ({
            ...item,
            invoiceId: invoice.id,
        }));

        setInvoices((currentInvoices) =>
            existingInvoice
                ? currentInvoices.map((currentInvoice) =>
                      currentInvoice.id === invoice.id
                          ? invoice
                          : currentInvoice,
                  )
                : [invoice, ...currentInvoices],
        );
        setInvoiceItems((currentItems) => [
            ...currentItems.filter(
                (item) => item.invoiceId !== invoice.id,
            ),
            ...consistentItems,
        ]);

        return { success: true };
    }

    function getInvoiceById(invoiceId: number) {
        return invoices.find((invoice) => invoice.id === invoiceId);
    }

    function completeDraftInvoice(
        invoiceId: number,
    ): SalesActionResult {
        if (completionLocks.current.has(invoiceId)) {
            return {
                success: false,
                error: "جاري اعتماد الفاتورة أو تم اعتمادها بالفعل.",
            };
        }

        completionLocks.current.add(invoiceId);
        const invoice = invoices.find(
            (currentInvoice) =>
                currentInvoice.id === invoiceId,
        );
        const items = invoiceItems.filter(
            (item) => item.invoiceId === invoiceId,
        );
        const completion = buildSaleCompletionPlan({
            invoice,
            invoices,
            items,
            products,
            customers,
            stockMovements,
            customerTransactions: transactions,
            completedAt: new Date().toISOString(),
        });

        if (!completion.success) {
            completionLocks.current.delete(invoiceId);
            return {
                success: false,
                error: completion.error,
            };
        }

        const { plan } = completion;

        applySaleStockPlan(
            plan.updatedProducts,
            plan.stockMovements,
        );

        if (plan.customerTransaction) {
            applySaleTransaction(plan.customerTransaction);
        }

        setInvoices((currentInvoices) =>
            currentInvoices.map((currentInvoice) =>
                currentInvoice.id === invoiceId
                    ? plan.completedInvoice
                    : currentInvoice,
            ),
        );

        return { success: true };
    }

    function getItemsByInvoiceId(invoiceId: number) {
        return invoiceItems.filter(
            (item) => item.invoiceId === invoiceId,
        );
    }

    function cancelCompletedInvoice(
        invoiceId: number,
        reason: string,
    ): SalesActionResult {
        if (cancellationLocks.current.has(invoiceId)) {
            return {
                success: false,
                error: "جاري إلغاء الفاتورة أو تم إلغاؤها بالفعل.",
            };
        }

        cancellationLocks.current.add(invoiceId);
        const invoice = invoices.find(
            (currentInvoice) =>
                currentInvoice.id === invoiceId,
        );
        const items = invoiceItems.filter(
            (item) => item.invoiceId === invoiceId,
        );
        const cancellation = buildSaleCancellationPlan({
            invoice,
            items,
            products,
            stockMovements,
            customerTransactions: transactions,
            reason,
            cancelledAt: new Date().toISOString(),
        });

        if (!cancellation.success) {
            cancellationLocks.current.delete(invoiceId);
            return {
                success: false,
                error: cancellation.error,
            };
        }

        const { plan } = cancellation;

        applySaleStockPlan(
            plan.updatedProducts,
            plan.reversalStockMovements,
        );

        if (plan.voidedCustomerTransaction) {
            applySaleTransactionVoid(
                plan.voidedCustomerTransaction,
            );
        }

        setInvoices((currentInvoices) =>
            currentInvoices.map((currentInvoice) =>
                currentInvoice.id === invoiceId
                    ? plan.cancelledInvoice
                    : currentInvoice,
            ),
        );

        return { success: true };
    }

    return (
        <SalesContext.Provider
            value={{
                invoices,
                invoiceItems,
                addInvoice,
                updateInvoice,
                saveDraftInvoice,
                deleteDraftInvoice,
                completeDraftInvoice,
                cancelCompletedInvoice,
                getInvoiceById,
                getItemsByInvoiceId,
            }}
        >
            {children}
        </SalesContext.Provider>
    );
}

// oxlint-disable-next-line react/only-export-components
export function useSales() {
    const context = useContext(SalesContext);

    if (!context) {
        throw new Error("useSales must be used inside SalesProvider");
    }

    return context;
}
