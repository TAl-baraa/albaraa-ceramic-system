import {
    createContext,
    useContext,
    useEffect,
    useRef,
    useState,
} from "react";
import type { ReactNode } from "react";

import { buildSaleCancellationPlan } from "../services/saleCancellation";
import { buildSaleCompletionPlan } from "../services/saleCompletion";
import type {
    SaleInvoice,
    SaleInvoiceItem,
} from "../types/sale";
import {
    readStoredSaleInvoiceItems,
    readStoredSaleInvoices,
    writeStoredSaleInvoiceItems,
    writeStoredSaleInvoices,
} from "../utils/salesStorage";
import { useCustomers } from "./CustomersContext";
import { useProducts } from "./ProductsContext";

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
        readStoredSaleInvoices(),
    );
    const [invoiceItems, setInvoiceItems] = useState<
        SaleInvoiceItem[]
    >(() =>
        readStoredSaleInvoiceItems(),
    );

    useEffect(() => {
        try {
            writeStoredSaleInvoices(invoices);
        } catch {
            // Keep sales usable in memory if browser storage is unavailable.
        }
    }, [invoices]);

    useEffect(() => {
        try {
            writeStoredSaleInvoiceItems(invoiceItems);
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
