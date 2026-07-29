import type { FormEvent, ReactNode } from "react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import {
    AlertTriangle,
    Eye,
    Pencil,
    Plus,
    Search,
    Trash2,
    Users,
    WalletCards,
    X,
} from "lucide-react";

import { useCustomers } from "../context/CustomersContext";
import type {
    Currency,
    Customer,
    CustomerActionResult,
    CustomerBalance,
    CustomerTransaction,
    CustomerTransactionCorrectionInput,
    CustomerTransactionType,
    EditableCustomerTransactionType,
} from "../types/customer";
import {
    filterTransactionsByCurrency,
    recalculateCustomerTransactionHistory,
} from "../utils/customerBalance";

const OVERDUE_DAYS = 30;
const MILLISECONDS_PER_DAY = 1000 * 60 * 60 * 24;

const transactionTypeLabels: Record<
    CustomerTransactionType,
    string
> = {
    debt: "دين على العميل",
    credit: "دين للعميل",
    payment_received: "دفعة مستلمة",
    payment_paid: "دفعة مدفوعة",
    adjustment: "تصحيح",
};

const editableTransactionTypes: EditableCustomerTransactionType[] = [
    "debt",
    "credit",
    "payment_received",
    "payment_paid",
];

function calculateDaysSince(date: string) {
    const referenceDate = new Date(date);
    const today = new Date();
    referenceDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    return Math.max(
        0,
        Math.floor(
            (today.getTime() - referenceDate.getTime()) /
                MILLISECONDS_PER_DAY,
        ),
    );
}

function isCustomerOverdue(
    customer: Customer,
    balance: number,
) {
    const referenceDate =
        customer.lastPaymentAt ?? customer.createdAt;

    return (
        balance > 0 &&
        calculateDaysSince(referenceDate) > OVERDUE_DAYS
    );
}

function getBalanceStatus(balance: number) {
    if (balance > 0) {
        return {
            label: "عليه لنا",
            className: "bg-red-50 text-red-700",
        };
    }

    if (balance < 0) {
        return {
            label: "له علينا",
            className: "bg-blue-50 text-blue-700",
        };
    }

    return {
        label: "مسدد",
        className: "bg-emerald-50 text-emerald-700",
    };
}

function formatBalance(amount: number, currency: Currency) {
    if (currency === "USD") {
        return `USD ${amount.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })}`;
    }

    return `${amount.toLocaleString("ar-IQ", {
        maximumFractionDigits: 6,
    })} IQD`;
}

function formatSummaryAmount(amount: number, currency: Currency) {
    return amount.toLocaleString(
        currency === "IQD" ? "ar-IQ" : "en-US",
        currency === "USD"
            ? {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
              }
            : { maximumFractionDigits: 6 },
    );
}

function CustomersPage() {
    const {
        customers,
        transactions,
        addCustomer,
        updateCustomer,
        deleteCustomer,
        addTransaction,
        correctTransaction,
        voidTransaction,
        getCustomerBalance,
    } = useCustomers();

    const [searchTerm, setSearchTerm] = useState("");
    const [isCustomerDialogOpen, setIsCustomerDialogOpen] =
        useState(false);
    const [customerToEdit, setCustomerToEdit] =
        useState<Customer | null>(null);
    const [customerToDelete, setCustomerToDelete] =
        useState<Customer | null>(null);
    const [selectedCustomerId, setSelectedCustomerId] =
        useState<number | null>(null);
    const [isTransactionDialogOpen, setIsTransactionDialogOpen] =
        useState(false);
    const [actionError, setActionError] = useState("");
    const [transactionToCorrect, setTransactionToCorrect] =
        useState<CustomerTransaction | null>(null);
    const [transactionToVoid, setTransactionToVoid] =
        useState<CustomerTransaction | null>(null);
    const [selectedCurrency, setSelectedCurrency] =
        useState<Currency>("IQD");
    const [detailsCurrency, setDetailsCurrency] =
        useState<Currency>("IQD");

    const [customerName, setCustomerName] = useState("");
    const [customerPhone, setCustomerPhone] = useState("");
    const [customerAddress, setCustomerAddress] = useState("");
    const [customerNotes, setCustomerNotes] = useState("");
    const [customerFormError, setCustomerFormError] = useState("");

    const [transactionType, setTransactionType] =
        useState<CustomerTransactionType>("debt");
    const [transactionAmount, setTransactionAmount] = useState("");
    const [transactionCurrency, setTransactionCurrency] =
        useState<Currency>("IQD");
    const [transactionNote, setTransactionNote] = useState("");
    const [transactionError, setTransactionError] = useState("");

    const selectedCustomer = customers.find(
        (customer) => customer.id === selectedCustomerId,
    );
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const filteredCustomers = customers.filter(
        (customer) =>
            customer.name.toLowerCase().includes(normalizedSearch) ||
            customer.phone.includes(normalizedSearch),
    );
    const customerBalances = customers.map((customer) => ({
        customer,
        balance: getCustomerBalance(customer.id),
    }));
    const totalCustomersOweUs = customerBalances.reduce(
        (total, { balance }) =>
            total + Math.max(balance[selectedCurrency], 0),
        0,
    );
    const totalWeOweCustomers = customerBalances.reduce(
        (total, { balance }) =>
            total +
            Math.abs(Math.min(balance[selectedCurrency], 0)),
        0,
    );
    const overdueCustomersCount = customerBalances.filter(
        ({ customer, balance }) =>
            isCustomerOverdue(
                customer,
                balance[selectedCurrency],
            ),
    ).length;
    const currencyArabicName =
        selectedCurrency === "IQD" ? "الدينار" : "الدولار";
    const currencyUnit =
        selectedCurrency === "IQD"
            ? "دينار عراقي"
            : "دولار أمريكي";

    function resetCustomerForm() {
        setCustomerName("");
        setCustomerPhone("");
        setCustomerAddress("");
        setCustomerNotes("");
        setCustomerFormError("");
    }

    function openAddCustomerDialog() {
        setCustomerToEdit(null);
        resetCustomerForm();
        setIsCustomerDialogOpen(true);
    }

    function openEditCustomerDialog(customer: Customer) {
        setCustomerToEdit(customer);
        setCustomerName(customer.name);
        setCustomerPhone(customer.phone);
        setCustomerAddress(customer.address);
        setCustomerNotes(customer.notes);
        setCustomerFormError("");
        setIsCustomerDialogOpen(true);
    }

    function closeCustomerDialog() {
        setIsCustomerDialogOpen(false);
        setCustomerToEdit(null);
        resetCustomerForm();
    }

    function handleCustomerSubmit(
        event: FormEvent<HTMLFormElement>,
    ) {
        event.preventDefault();

        if (!customerName.trim()) {
            setCustomerFormError("اسم العميل مطلوب.");
            return;
        }

        const input = {
            name: customerName,
            phone: customerPhone,
            address: customerAddress,
            notes: customerNotes,
        };
        const result = customerToEdit
            ? updateCustomer(customerToEdit.id, input)
            : addCustomer(input);

        if (!result.success) {
            setCustomerFormError(result.error);
            return;
        }

        closeCustomerDialog();
    }

    function requestCustomerDeletion(customer: Customer) {
        setActionError("");

        if (
            transactions.some(
                (transaction) =>
                    transaction.customerId === customer.id,
            )
        ) {
            setActionError(
                `لا يمكن حذف العميل ${customer.name} لوجود حركات مالية مسجلة.`,
            );
            return;
        }

        setCustomerToDelete(customer);
    }

    function handleCustomerDeletion() {
        if (!customerToDelete) {
            return;
        }

        const result = deleteCustomer(customerToDelete.id);

        if (!result.success) {
            setActionError(result.error);
            setCustomerToDelete(null);
            return;
        }

        if (selectedCustomerId === customerToDelete.id) {
            setSelectedCustomerId(null);
        }
        setCustomerToDelete(null);
    }

    function resetTransactionForm(currency: Currency = detailsCurrency) {
        setTransactionType("debt");
        setTransactionAmount("");
        setTransactionCurrency(currency);
        setTransactionNote("");
        setTransactionError("");
    }

    function openTransactionDialog() {
        resetTransactionForm(detailsCurrency);
        setIsTransactionDialogOpen(true);
    }

    function closeTransactionDialog() {
        setIsTransactionDialogOpen(false);
        resetTransactionForm(detailsCurrency);
    }

    function openCustomerDetails(customerId: number) {
        setDetailsCurrency(selectedCurrency);
        setSelectedCustomerId(customerId);
    }

    function handleTransactionSubmit(
        event: FormEvent<HTMLFormElement>,
    ) {
        event.preventDefault();

        if (!selectedCustomer) {
            setTransactionError("العميل غير موجود.");
            return;
        }

        const amount = Number(transactionAmount);

        if (
            transactionAmount.trim() === "" ||
            !Number.isFinite(amount) ||
            amount <= 0
        ) {
            setTransactionError("يجب أن يكون المبلغ أكبر من صفر.");
            return;
        }

        const result = addTransaction({
            customerId: selectedCustomer.id,
            type: transactionType,
            amount,
            currency: transactionCurrency,
            note: transactionNote,
        });

        if (!result.success) {
            setTransactionError(result.error);
            return;
        }

        closeTransactionDialog();
    }

    return (
        <section>
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h3 className="text-2xl font-bold">العملاء</h3>
                    <p className="mt-1 text-sm text-slate-500">
                        إدارة بيانات العملاء ومتابعة أرصدتهم وحالة الدفع.
                    </p>
                </div>
                <div className="flex flex-col gap-3 sm:items-end">
                    <CurrencySegmentedControl
                        value={selectedCurrency}
                        onChange={setSelectedCurrency}
                        ariaLabel="عملة عرض حسابات العملاء"
                    />
                    <button
                        type="button"
                        onClick={openAddCustomerDialog}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
                    >
                        <Plus size={18} />
                        <span>إضافة عميل</span>
                    </button>
                </div>
            </div>

            <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <SummaryCard
                    label="إجمالي العملاء"
                    value={customers.length.toLocaleString("ar-IQ")}
                    icon={<Users size={22} />}
                    iconClassName="bg-slate-100 text-slate-700"
                />
                <SummaryCard
                    label={`ديون العملاء لنا ب${currencyArabicName}`}
                    value={formatSummaryAmount(
                        totalCustomersOweUs,
                        selectedCurrency,
                    )}
                    unit={currencyUnit}
                    icon={<WalletCards size={22} />}
                    iconClassName="bg-red-50 text-red-700"
                />
                <SummaryCard
                    label={`ديوننا للعملاء ب${currencyArabicName}`}
                    value={formatSummaryAmount(
                        totalWeOweCustomers,
                        selectedCurrency,
                    )}
                    unit={currencyUnit}
                    icon={<WalletCards size={22} />}
                    iconClassName="bg-blue-50 text-blue-700"
                />
                <SummaryCard
                    label="عملاء متأخرون"
                    value={overdueCustomersCount.toLocaleString("ar-IQ")}
                    unit="عميل"
                    icon={<AlertTriangle size={22} />}
                    iconClassName="bg-amber-50 text-amber-700"
                />
            </div>

            {actionError && (
                <div className="mb-5 flex items-center justify-between gap-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                    <span>{actionError}</span>
                    <button
                        type="button"
                        onClick={() => setActionError("")}
                        aria-label="إغلاق الرسالة"
                    >
                        <X size={18} />
                    </button>
                </div>
            )}

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
                            placeholder="ابحث بالاسم أو رقم الهاتف"
                            className="w-full rounded-xl border border-slate-200 py-3 pr-10 pl-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full min-w-[1050px] text-right text-sm">
                        <thead className="bg-slate-50 text-slate-600">
                            <tr>
                                <th className="px-5 py-4 font-semibold">الاسم</th>
                                <th className="px-5 py-4 font-semibold">الهاتف</th>
                                <th className="px-5 py-4 font-semibold">
                                    صافي الحساب {selectedCurrency}
                                </th>
                                <th className="px-5 py-4 font-semibold">آخر دفعة</th>
                                <th className="px-5 py-4 font-semibold">الحالة</th>
                                <th className="px-5 py-4 font-semibold">الإجراءات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredCustomers.map((customer) => {
                                const balance = getCustomerBalance(customer.id);
                                const selectedBalance =
                                    balance[selectedCurrency];
                                const status =
                                    getBalanceStatus(selectedBalance);
                                const overdue = isCustomerOverdue(
                                    customer,
                                    selectedBalance,
                                );

                                return (
                                    <tr
                                        key={customer.id}
                                        onClick={() =>
                                            openCustomerDetails(customer.id)
                                        }
                                        className="cursor-pointer transition hover:bg-slate-50"
                                    >
                                        <td className="px-5 py-4 font-semibold">
                                            {customer.name}
                                        </td>
                                        <td className="px-5 py-4 text-slate-600" dir="ltr">
                                            {customer.phone || "—"}
                                        </td>
                                        <BalanceCell
                                            amount={selectedBalance}
                                            currency={selectedCurrency}
                                        />
                                        <td className="px-5 py-4 text-slate-600">
                                            {customer.lastPaymentAt
                                                ? new Date(
                                                      customer.lastPaymentAt,
                                                  ).toLocaleDateString("ar-IQ")
                                                : "لا توجد دفعات"}
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="flex flex-wrap gap-2">
                                                <span
                                                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${status.className}`}
                                                >
                                                    {status.label}
                                                </span>
                                                {overdue && (
                                                    <span className="inline-flex rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                                                        متأخر
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="flex gap-1">
                                                <ActionButton
                                                    label="عرض التفاصيل"
                                                    onClick={() =>
                                                        openCustomerDetails(
                                                            customer.id,
                                                        )
                                                    }
                                                >
                                                    <Eye size={18} />
                                                </ActionButton>
                                                <ActionButton
                                                    label="تعديل العميل"
                                                    onClick={() =>
                                                        openEditCustomerDialog(
                                                            customer,
                                                        )
                                                    }
                                                    className="text-blue-600 hover:bg-blue-50"
                                                >
                                                    <Pencil size={18} />
                                                </ActionButton>
                                                <ActionButton
                                                    label="حذف العميل"
                                                    onClick={() =>
                                                        requestCustomerDeletion(
                                                            customer,
                                                        )
                                                    }
                                                    className="text-red-600 hover:bg-red-50"
                                                >
                                                    <Trash2 size={18} />
                                                </ActionButton>
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
                        <p className="font-semibold">لا يوجد عميل مطابق</p>
                        <p className="mt-1 text-sm text-slate-500">
                            جرّب البحث باسم أو رقم هاتف مختلف.
                        </p>
                    </div>
                )}
            </div>

            {isCustomerDialogOpen && (
                <CustomerFormDialog
                    isEditing={customerToEdit !== null}
                    name={customerName}
                    phone={customerPhone}
                    address={customerAddress}
                    notes={customerNotes}
                    error={customerFormError}
                    onNameChange={setCustomerName}
                    onPhoneChange={setCustomerPhone}
                    onAddressChange={setCustomerAddress}
                    onNotesChange={setCustomerNotes}
                    clearError={() => setCustomerFormError("")}
                    onClose={closeCustomerDialog}
                    onSubmit={handleCustomerSubmit}
                />
            )}

            {selectedCustomer && (
                <CustomerDetailsDialog
                    customer={selectedCustomer}
                    balance={getCustomerBalance(selectedCustomer.id)}
                    transactions={transactions.filter(
                        (transaction) =>
                            transaction.customerId === selectedCustomer.id,
                    )}
                    selectedCurrency={detailsCurrency}
                    onCurrencyChange={setDetailsCurrency}
                    onCorrectTransaction={setTransactionToCorrect}
                    onVoidTransaction={setTransactionToVoid}
                    onClose={() => setSelectedCustomerId(null)}
                    onAddTransaction={openTransactionDialog}
                    onEdit={() => {
                        setSelectedCustomerId(null);
                        openEditCustomerDialog(selectedCustomer);
                    }}
                />
            )}

            {isTransactionDialogOpen &&
                selectedCustomer &&
                createPortal(
                    <TransactionDialog
                        customerName={selectedCustomer.name}
                        type={transactionType}
                        amount={transactionAmount}
                        currency={transactionCurrency}
                        note={transactionNote}
                        error={transactionError}
                        onTypeChange={setTransactionType}
                        onAmountChange={setTransactionAmount}
                        onCurrencyChange={setTransactionCurrency}
                        onNoteChange={setTransactionNote}
                        clearError={() => setTransactionError("")}
                        onClose={closeTransactionDialog}
                        onSubmit={handleTransactionSubmit}
                    />,
                    document.body,
                )}

            {transactionToCorrect &&
                createPortal(
                    <CorrectionDialog
                        transaction={transactionToCorrect}
                        onClose={() => setTransactionToCorrect(null)}
                        onSubmit={(input) => {
                            const result = correctTransaction(input);

                            if (result.success) {
                                setTransactionToCorrect(null);
                            }

                            return result;
                        }}
                    />,
                    document.body,
                )}

            {transactionToVoid &&
                createPortal(
                    <VoidTransactionDialog
                        transaction={transactionToVoid}
                        onClose={() => setTransactionToVoid(null)}
                        onConfirm={(reason) => {
                            const result = voidTransaction(
                                transactionToVoid.id,
                                reason,
                            );

                            if (result.success) {
                                setTransactionToVoid(null);
                            }

                            return result;
                        }}
                    />,
                    document.body,
                )}

            {customerToDelete && (
                <ConfirmationDialog
                    customerName={customerToDelete.name}
                    onClose={() => setCustomerToDelete(null)}
                    onConfirm={handleCustomerDeletion}
                />
            )}
        </section>
    );
}

type SummaryCardProps = {
    label: string;
    value: string;
    unit?: string;
    icon: ReactNode;
    iconClassName: string;
};

function SummaryCard({
    label,
    value,
    unit,
    icon,
    iconClassName,
}: SummaryCardProps) {
    return (
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <p className="text-sm text-slate-500">{label}</p>
                    <p className="mt-2 text-2xl font-bold">{value}</p>
                    {unit && (
                        <p className="mt-1 text-sm text-slate-500">{unit}</p>
                    )}
                </div>
                <div className={`rounded-xl p-3 ${iconClassName}`}>
                    {icon}
                </div>
            </div>
        </article>
    );
}

function CurrencySegmentedControl({
    value,
    onChange,
    ariaLabel,
}: {
    value: Currency;
    onChange: (currency: Currency) => void;
    ariaLabel: string;
}) {
    const options: { value: Currency; label: string }[] = [
        { value: "IQD", label: "الدينار العراقي" },
        { value: "USD", label: "الدولار الأمريكي" },
    ];

    return (
        <div
            role="group"
            aria-label={ariaLabel}
            className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1"
        >
            {options.map((option) => (
                <button
                    key={option.value}
                    type="button"
                    onClick={() => onChange(option.value)}
                    aria-pressed={value === option.value}
                    className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                        value === option.value
                            ? "bg-white text-slate-900 shadow-sm"
                            : "text-slate-500 hover:text-slate-800"
                    }`}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
}

function BalanceCell({
    amount,
    currency,
}: {
    amount: number;
    currency: Currency;
}) {
    return (
        <td
            className={`px-5 py-4 font-semibold ${
                amount > 0
                    ? "text-red-700"
                    : amount < 0
                      ? "text-blue-700"
                      : "text-slate-500"
            }`}
        >
            {amount === 0 ? "—" : formatBalance(amount, currency)}
        </td>
    );
}

type ActionButtonProps = {
    label: string;
    onClick: () => void;
    children: ReactNode;
    className?: string;
};

function ActionButton({
    label,
    onClick,
    children,
    className = "text-slate-600 hover:bg-slate-100",
}: ActionButtonProps) {
    return (
        <button
            type="button"
            onClick={(event) => {
                event.stopPropagation();
                onClick();
            }}
            aria-label={label}
            title={label}
            className={`rounded-lg p-2 transition ${className}`}
        >
            {children}
        </button>
    );
}

type CustomerFormDialogProps = {
    isEditing: boolean;
    name: string;
    phone: string;
    address: string;
    notes: string;
    error: string;
    onNameChange: (value: string) => void;
    onPhoneChange: (value: string) => void;
    onAddressChange: (value: string) => void;
    onNotesChange: (value: string) => void;
    clearError: () => void;
    onClose: () => void;
    onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

function CustomerFormDialog(props: CustomerFormDialogProps) {
    return (
        <ModalShell
            title={props.isEditing ? "تعديل العميل" : "إضافة عميل"}
            description="أدخل بيانات العميل الأساسية."
            onClose={props.onClose}
        >
            <form onSubmit={props.onSubmit} className="p-5">
                <div className="grid gap-5 sm:grid-cols-2">
                    <FormField label="اسم العميل" className="sm:col-span-2">
                        <input
                            type="text"
                            value={props.name}
                            onChange={(event) => {
                                props.onNameChange(event.target.value);
                                props.clearError();
                            }}
                            autoFocus
                            className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                        />
                    </FormField>
                    <FormField label="رقم الهاتف">
                        <input
                            type="tel"
                            value={props.phone}
                            onChange={(event) => {
                                props.onPhoneChange(event.target.value);
                                props.clearError();
                            }}
                            dir="ltr"
                            className="rounded-xl border border-slate-200 px-4 py-3 text-right text-sm outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                        />
                    </FormField>
                    <FormField label="العنوان">
                        <input
                            type="text"
                            value={props.address}
                            onChange={(event) => {
                                props.onAddressChange(event.target.value);
                                props.clearError();
                            }}
                            className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                        />
                    </FormField>
                    <FormField label="ملاحظات" className="sm:col-span-2">
                        <textarea
                            value={props.notes}
                            onChange={(event) => {
                                props.onNotesChange(event.target.value);
                                props.clearError();
                            }}
                            rows={3}
                            className="resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                        />
                    </FormField>
                </div>
                <DialogError error={props.error} />
                <DialogActions onClose={props.onClose} submitLabel="حفظ العميل" />
            </form>
        </ModalShell>
    );
}

type CustomerDetailsDialogProps = {
    customer: Customer;
    balance: CustomerBalance;
    transactions: CustomerTransaction[];
    selectedCurrency: Currency;
    onCurrencyChange: (currency: Currency) => void;
    onCorrectTransaction: (
        transaction: CustomerTransaction,
    ) => void;
    onVoidTransaction: (transaction: CustomerTransaction) => void;
    onClose: () => void;
    onAddTransaction: () => void;
    onEdit: () => void;
};

function CustomerDetailsDialog({
    customer,
    balance,
    transactions,
    selectedCurrency,
    onCurrencyChange,
    onCorrectTransaction,
    onVoidTransaction,
    onClose,
    onAddTransaction,
    onEdit,
}: CustomerDetailsDialogProps) {
    const historyRows = filterTransactionsByCurrency(
        recalculateCustomerTransactionHistory(
            transactions,
            customer.id,
        ),
        selectedCurrency,
    ).toSorted(
            (first, second) =>
                Date.parse(second.createdAt) -
                    Date.parse(first.createdAt) ||
                second.id - first.id,
        );
    const selectedBalance = balance[selectedCurrency];
    const status = getBalanceStatus(selectedBalance);

    return (
        <ModalShell
            title={customer.name}
            description="تفاصيل العميل والحركات المالية."
            onClose={onClose}
            maxWidth="max-w-5xl"
        >
            <div className="p-5">
                <div className="mb-5 flex justify-start">
                    <CurrencySegmentedControl
                        value={selectedCurrency}
                        onChange={onCurrencyChange}
                        ariaLabel="عملة عرض تفاصيل العميل"
                    />
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <InfoBox label="رقم الهاتف" value={customer.phone || "—"} />
                    <InfoBox label="العنوان" value={customer.address || "—"} />
                    <div className="rounded-xl bg-slate-50 p-4">
                        <p className="text-xs text-slate-500">
                            صافي الحساب {selectedCurrency}
                        </p>
                        <p
                            className={`mt-2 text-xl font-bold ${
                                selectedBalance > 0
                                    ? "text-red-700"
                                    : selectedBalance < 0
                                      ? "text-blue-700"
                                      : "text-slate-600"
                            }`}
                        >
                            {formatBalance(
                                selectedBalance,
                                selectedCurrency,
                            )}
                        </p>
                        <span
                            className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${status.className}`}
                        >
                            {status.label}
                        </span>
                    </div>
                </div>
                {customer.notes && (
                    <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                        {customer.notes}
                    </div>
                )}

                <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                    <h5 className="font-bold">الحركات المالية</h5>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={onEdit}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold hover:bg-slate-100"
                        >
                            <Pencil size={17} /> تعديل البيانات
                        </button>
                        <button
                            type="button"
                            onClick={onAddTransaction}
                            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
                        >
                            <Plus size={17} /> إضافة حركة
                        </button>
                    </div>
                </div>

                <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full min-w-[1100px] text-right text-sm">
                        <thead className="bg-slate-50 text-slate-600">
                            <tr>
                                <th className="px-4 py-3">التاريخ</th>
                                <th className="px-4 py-3">النوع</th>
                                <th className="px-4 py-3">المبلغ</th>
                                <th className="px-4 py-3">العملة</th>
                                <th className="px-4 py-3">الملاحظة</th>
                                <th className="px-4 py-3">الرصيد بعد الحركة</th>
                                <th className="px-4 py-3">الإجراءات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {historyRows.map((transaction) => {
                                return (
                                    <tr
                                        key={transaction.id}
                                        className={
                                            transaction.status === "voided"
                                                ? "bg-slate-50 text-slate-400"
                                                : ""
                                        }
                                    >
                                        <td
                                            className={`whitespace-nowrap px-4 py-3 ${
                                                transaction.status === "voided"
                                                    ? "line-through"
                                                    : ""
                                            }`}
                                        >
                                            {new Date(
                                                transaction.createdAt,
                                            ).toLocaleString("ar-IQ", {
                                                dateStyle: "medium",
                                                timeStyle: "short",
                                            })}
                                        </td>
                                        <td className="px-4 py-3 font-medium">
                                            {transactionTypeLabels[transaction.type]}
                                            <div className="mt-1 flex flex-wrap gap-1">
                                                {transaction.status ===
                                                    "voided" && (
                                                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                                                        ملغاة
                                                    </span>
                                                )}
                                                {transaction.createdByCorrection && (
                                                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                                                        حركة مصححة
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td
                                            className={`px-4 py-3 font-semibold ${
                                                transaction.status === "voided"
                                                    ? "line-through"
                                                    : ""
                                            }`}
                                        >
                                            {formatBalance(
                                                transaction.amount,
                                                selectedCurrency,
                                            )}
                                        </td>
                                        <td className="px-4 py-3">{transaction.currency}</td>
                                        <td className="max-w-xs px-4 py-3 text-slate-600">
                                            {transaction.note || "—"}
                                            {transaction.sourceType ===
                                                "sale_invoice" &&
                                                transaction.sourceId !==
                                                    null && (
                                                    <Link
                                                        to={`/sales/${transaction.sourceId}`}
                                                        className="mt-1 block text-xs font-semibold text-blue-700 hover:underline"
                                                    >
                                                        فاتورة بيع{" "}
                                                        {
                                                            transaction.sourceReference
                                                        }
                                                    </Link>
                                                )}
                                            {transaction.createdByCorrection && (
                                                <p className="mt-1 text-xs text-blue-700">
                                                    بديلة عن حركة سابقة
                                                </p>
                                            )}
                                            {transaction.status === "voided" &&
                                                transaction.voidReason && (
                                                    <p className="mt-1 text-xs text-slate-500">
                                                        السبب:{" "}
                                                        {transaction.voidReason}
                                                    </p>
                                                )}
                                        </td>
                                        <td className="px-4 py-3 font-semibold">
                                            {formatBalance(
                                                transaction.balanceAfter[
                                                    transaction.currency
                                                ],
                                                transaction.currency,
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            {transaction.status === "active" && (
                                                <div className="flex gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            onCorrectTransaction(
                                                                transaction,
                                                            )
                                                        }
                                                        className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                                                    >
                                                        تصحيح
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            onVoidTransaction(
                                                                transaction,
                                                            )
                                                        }
                                                        className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
                                                    >
                                                        إلغاء
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {historyRows.length === 0 && (
                        <div className="p-10 text-center text-sm text-slate-500">
                            لا توجد حركات مالية لهذا العميل بعملة{" "}
                            {selectedCurrency}.
                        </div>
                    )}
                </div>
            </div>
        </ModalShell>
    );
}

type TransactionDialogProps = {
    customerName: string;
    type: CustomerTransactionType;
    amount: string;
    currency: Currency;
    note: string;
    error: string;
    onTypeChange: (value: CustomerTransactionType) => void;
    onAmountChange: (value: string) => void;
    onCurrencyChange: (value: Currency) => void;
    onNoteChange: (value: string) => void;
    clearError: () => void;
    onClose: () => void;
    onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

function CorrectionDialog({
    transaction,
    onClose,
    onSubmit,
}: {
    transaction: CustomerTransaction;
    onClose: () => void;
    onSubmit: (
        input: CustomerTransactionCorrectionInput,
    ) => CustomerActionResult;
}) {
    const [type, setType] =
        useState<EditableCustomerTransactionType>(
            transaction.type === "adjustment"
                ? "debt"
                : transaction.type,
        );
    const [amount, setAmount] = useState(
        transaction.amount.toString(),
    );
    const [note, setNote] = useState(transaction.note);
    const [reason, setReason] = useState("");
    const [error, setError] = useState("");

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const numericAmount = Number(amount);

        if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
            setError("يجب أن يكون المبلغ المصحح أكبر من صفر.");
            return;
        }

        if (!reason.trim()) {
            setError("سبب التصحيح مطلوب.");
            return;
        }

        const result = onSubmit({
            transactionId: transaction.id,
            type,
            amount: numericAmount,
            note,
            reason,
        });

        if (!result.success) {
            setError(result.error);
        }
    }

    return (
        <AuditModalShell title="تصحيح الحركة" onClose={onClose}>
            <form onSubmit={handleSubmit} className="p-5">
                <div className="mb-5 rounded-xl bg-slate-50 p-4">
                    <p className="mb-3 text-sm font-bold">
                        بيانات الحركة الأصلية
                    </p>
                    <div className="grid gap-3 text-sm sm:grid-cols-2">
                        <InfoBox
                            label="التاريخ"
                            value={new Date(
                                transaction.createdAt,
                            ).toLocaleString("ar-IQ")}
                        />
                        <InfoBox
                            label="النوع"
                            value={
                                transactionTypeLabels[transaction.type]
                            }
                        />
                        <InfoBox
                            label="المبلغ"
                            value={formatBalance(
                                transaction.amount,
                                transaction.currency,
                            )}
                        />
                        <InfoBox
                            label="العملة"
                            value={transaction.currency}
                        />
                        <div className="sm:col-span-2">
                            <InfoBox
                                label="الملاحظة"
                                value={transaction.note || "—"}
                            />
                        </div>
                    </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                    <FormField label="نوع الحركة المصحح">
                        <select
                            value={type}
                            onChange={(event) => {
                                setType(
                                    event.target
                                        .value as EditableCustomerTransactionType,
                                );
                                setError("");
                            }}
                            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
                            required
                        >
                            {editableTransactionTypes.map(
                                (transactionType) => (
                                    <option
                                        key={transactionType}
                                        value={transactionType}
                                    >
                                        {
                                            transactionTypeLabels[
                                                transactionType
                                            ]
                                        }
                                    </option>
                                ),
                            )}
                        </select>
                    </FormField>
                    <FormField label="العملة">
                        <input
                            value={transaction.currency}
                            readOnly
                            className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-500"
                        />
                    </FormField>
                    <FormField label="المبلغ المصحح">
                        <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={amount}
                            onChange={(event) => {
                                setAmount(event.target.value);
                                setError("");
                            }}
                            className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
                            required
                        />
                    </FormField>
                    <FormField label="سبب التصحيح">
                        <input
                            value={reason}
                            onChange={(event) => {
                                setReason(event.target.value);
                                setError("");
                            }}
                            className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
                            required
                        />
                    </FormField>
                    <FormField
                        label="الملاحظة المصححة"
                        className="sm:col-span-2"
                    >
                        <textarea
                            value={note}
                            onChange={(event) => {
                                setNote(event.target.value);
                                setError("");
                            }}
                            rows={3}
                            className="resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
                        />
                    </FormField>
                </div>
                <DialogError error={error} />
                <DialogActions
                    onClose={onClose}
                    submitLabel="حفظ التصحيح"
                />
            </form>
        </AuditModalShell>
    );
}

function VoidTransactionDialog({
    transaction,
    onClose,
    onConfirm,
}: {
    transaction: CustomerTransaction;
    onClose: () => void;
    onConfirm: (reason: string) => CustomerActionResult;
}) {
    const [reason, setReason] = useState("");
    const [error, setError] = useState("");

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (!reason.trim()) {
            setError("سبب الإلغاء مطلوب.");
            return;
        }

        const result = onConfirm(reason);

        if (!result.success) {
            setError(result.error);
        }
    }

    return (
        <AuditModalShell title="إلغاء الحركة" onClose={onClose}>
            <form onSubmit={handleSubmit} className="p-5">
                <p className="text-sm leading-6 text-slate-600">
                    سيتم إلغاء حركة{" "}
                    <strong>
                        {transactionTypeLabels[transaction.type]} بقيمة{" "}
                        {formatBalance(
                            transaction.amount,
                            transaction.currency,
                        )}
                    </strong>
                    . ستبقى الحركة ظاهرة في السجل ولن تؤثر في الرصيد.
                </p>
                <FormField label="سبب الإلغاء" className="mt-5">
                    <textarea
                        value={reason}
                        onChange={(event) => {
                            setReason(event.target.value);
                            setError("");
                        }}
                        rows={3}
                        className="resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
                        required
                        autoFocus
                    />
                </FormField>
                <DialogError error={error} />
                <DialogActions
                    onClose={onClose}
                    submitLabel="تأكيد الإلغاء"
                />
            </form>
        </AuditModalShell>
    );
}

function AuditModalShell({
    title,
    onClose,
    children,
}: {
    title: string;
    onClose: () => void;
    children: ReactNode;
}) {
    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <button
                type="button"
                onClick={onClose}
                aria-label="إغلاق النافذة"
                className="fixed inset-0 bg-slate-950/70"
            />
            <div
                role="dialog"
                aria-modal="true"
                className="relative z-[121] max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-xl"
            >
                <div className="flex items-center justify-between border-b border-slate-200 p-5">
                    <h4 className="text-lg font-bold">{title}</h4>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="إغلاق"
                        className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"
                    >
                        <X size={20} />
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
}

function TransactionDialog(props: TransactionDialogProps) {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <button
                type="button"
                onClick={props.onClose}
                aria-label="إغلاق نافذة الحركة"
                className="fixed inset-0 z-[100] bg-slate-950/70"
            />
            <div
                className="relative z-[101] w-full max-w-xl rounded-2xl bg-white shadow-xl"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="flex items-center justify-between border-b border-slate-200 p-5">
                    <div>
                        <h4 className="text-lg font-bold">إضافة حركة مالية</h4>
                        <p className="mt-1 text-sm text-slate-500">{props.customerName}</p>
                    </div>
                    <button type="button" onClick={props.onClose} aria-label="إغلاق">
                        <X size={20} />
                    </button>
                </div>
                <form onSubmit={props.onSubmit} className="p-5">
                    <div className="grid gap-5 sm:grid-cols-2">
                        <FormField label="نوع الحركة">
                            <select
                                value={props.type}
                                onChange={(event) => {
                                    props.onTypeChange(
                                        event.target.value as CustomerTransactionType,
                                    );
                                    props.clearError();
                                }}
                                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
                            >
                                {editableTransactionTypes.map(
                                    (value) => (
                                        <option key={value} value={value}>
                                            {transactionTypeLabels[value]}
                                        </option>
                                    ),
                                )}
                            </select>
                        </FormField>
                        <FormField label="العملة">
                            <select
                                value={props.currency}
                                onChange={(event) => {
                                    props.onCurrencyChange(
                                        event.target.value as Currency,
                                    );
                                    props.clearError();
                                }}
                                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
                            >
                                <option value="IQD">IQD</option>
                                <option value="USD">USD</option>
                            </select>
                        </FormField>
                        <FormField label="المبلغ" className="sm:col-span-2">
                            <input
                                type="number"
                                min="0.01"
                                step="0.01"
                                value={props.amount}
                                onChange={(event) => {
                                    props.onAmountChange(event.target.value);
                                    props.clearError();
                                }}
                                autoFocus
                                className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
                            />
                        </FormField>
                        <FormField label="ملاحظة" className="sm:col-span-2">
                            <textarea
                                value={props.note}
                                onChange={(event) => {
                                    props.onNoteChange(event.target.value);
                                    props.clearError();
                                }}
                                rows={3}
                                className="resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
                            />
                        </FormField>
                    </div>
                    <DialogError error={props.error} />
                    <DialogActions onClose={props.onClose} submitLabel="حفظ الحركة" />
                </form>
            </div>
        </div>
    );
}

function ConfirmationDialog({
    customerName,
    onClose,
    onConfirm,
}: {
    customerName: string;
    onClose: () => void;
    onConfirm: () => void;
}) {
    return (
        <ModalShell title="حذف العميل" onClose={onClose} maxWidth="max-w-md">
            <div className="p-5">
                <p className="text-sm text-slate-600">
                    هل أنت متأكد من حذف <strong>{customerName}</strong>؟
                </p>
                <div className="mt-6 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold"
                    >
                        إلغاء
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white"
                    >
                        تأكيد الحذف
                    </button>
                </div>
            </div>
        </ModalShell>
    );
}

function ModalShell({
    title,
    description,
    onClose,
    maxWidth = "max-w-2xl",
    children,
}: {
    title: string;
    description?: string;
    onClose: () => void;
    maxWidth?: string;
    children: ReactNode;
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <button
                type="button"
                onClick={onClose}
                aria-label="إغلاق النافذة"
                className="absolute inset-0 bg-slate-950/50"
            />
            <div
                role="dialog"
                aria-modal="true"
                className={`relative z-10 max-h-[90vh] w-full overflow-y-auto rounded-2xl bg-white shadow-xl ${maxWidth}`}
            >
                <div className="flex items-center justify-between border-b border-slate-200 p-5">
                    <div>
                        <h4 className="text-lg font-bold">{title}</h4>
                        {description && (
                            <p className="mt-1 text-sm text-slate-500">
                                {description}
                            </p>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="إغلاق"
                        className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"
                    >
                        <X size={20} />
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
}

function FormField({
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

function DialogError({ error }: { error: string }) {
    return error ? (
        <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
        </p>
    ) : null;
}

function DialogActions({
    onClose,
    submitLabel,
}: {
    onClose: () => void;
    submitLabel: string;
}) {
    return (
        <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-5">
            <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold hover:bg-slate-100"
            >
                إلغاء
            </button>
            <button
                type="submit"
                className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
            >
                {submitLabel}
            </button>
        </div>
    );
}

function InfoBox({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="mt-2 font-semibold">{value}</p>
        </div>
    );
}

export default CustomersPage;
