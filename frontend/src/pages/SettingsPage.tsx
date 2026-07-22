import { Save, ShieldCheck, Store, UserCog } from "lucide-react";
import { useState } from "react";

/*
 * يمثل إعدادات النظام التي يستطيع المدير تعديلها.
 * ستُحفظ لاحقًا داخل قاعدة البيانات بدل بقائها في الواجهة فقط.
 */
type SystemSettings = {
    storeName: string;
    phone: string;
    address: string;
    currency: "IQD";
    paymentDelayDays: number;
    lowStockNotifications: boolean;
};

/*
 * القيم الافتراضية التي تظهر عند فتح صفحة الإعدادات.
 */
const initialSettings: SystemSettings = {
    storeName: "معرض البراء للسيراميك",
    phone: "",
    address: "",
    currency: "IQD",
    paymentDelayDays: 30,
    lowStockNotifications: true,
};

function SettingsPage() {
    /*
     * settings تحتوي على القيم الحالية داخل الحقول.
     * setSettings تستخدم لتعديل تلك القيم.
     */
    const [settings, setSettings] =
        useState<SystemSettings>(initialSettings);

    /*
     * نستخدم هذه الحالة لإظهار رسالة قصيرة بعد الضغط على الحفظ.
     */
    const [savedSuccessfully, setSavedSuccessfully] = useState(false);

    /*
     * تحدث حقلًا واحدًا من الإعدادات دون تغيير بقية الحقول.
     */
    function updateSetting<Key extends keyof SystemSettings>(
        key: Key,
        value: SystemSettings[Key],
    ) {
        setSettings((currentSettings) => ({
            ...currentSettings,
            [key]: value,
        }));

        // نخفي رسالة النجاح عند حدوث تعديل جديد.
        setSavedSuccessfully(false);
    }

    /*
     * تمنع إعادة تحميل الصفحة عند إرسال النموذج.
     * الحفظ حاليًا تجريبي، وسنربطه لاحقًا بالخادم.
     */
    function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setSavedSuccessfully(true);
    }

    return (
        <section>
            <div className="mb-6">
                <h3 className="text-2xl font-bold">الإعدادات</h3>

                <p className="mt-1 text-sm text-slate-500">
                    إدارة معلومات المعرض والإعدادات العامة والمستخدمين.
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* معلومات المعرض */}
                <article className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex items-center gap-3 border-b border-slate-200 p-5">
                        <div className="rounded-xl bg-slate-100 p-3 text-slate-700">
                            <Store size={21} />
                        </div>

                        <div>
                            <h4 className="font-bold">معلومات المعرض</h4>
                            <p className="mt-1 text-sm text-slate-500">
                                البيانات الأساسية التي ستظهر في النظام والفواتير.
                            </p>
                        </div>
                    </div>

                    <div className="grid gap-5 p-5 md:grid-cols-2">
                        <label className="grid gap-2">
                            <span className="text-sm font-semibold">اسم المعرض</span>

                            <input
                                type="text"
                                value={settings.storeName}
                                onChange={(event) =>
                                    updateSetting("storeName", event.target.value)
                                }
                                className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                            />
                        </label>

                        <label className="grid gap-2">
                            <span className="text-sm font-semibold">رقم الهاتف</span>

                            <input
                                type="tel"
                                value={settings.phone}
                                onChange={(event) =>
                                    updateSetting("phone", event.target.value)
                                }
                                placeholder="07XXXXXXXXX"
                                dir="ltr"
                                className="rounded-xl border border-slate-200 px-4 py-3 text-right text-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                            />
                        </label>

                        <label className="grid gap-2 md:col-span-2">
                            <span className="text-sm font-semibold">عنوان المعرض</span>

                            <input
                                type="text"
                                value={settings.address}
                                onChange={(event) =>
                                    updateSetting("address", event.target.value)
                                }
                                placeholder="اكتب عنوان المعرض"
                                className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                            />
                        </label>
                    </div>
                </article>

                {/* إعدادات النظام */}
                <article className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex items-center gap-3 border-b border-slate-200 p-5">
                        <div className="rounded-xl bg-blue-50 p-3 text-blue-700">
                            <ShieldCheck size={21} />
                        </div>

                        <div>
                            <h4 className="font-bold">إعدادات النظام</h4>
                            <p className="mt-1 text-sm text-slate-500">
                                الإعدادات التي تؤثر في التنبيهات والحسابات.
                            </p>
                        </div>
                    </div>

                    <div className="grid gap-5 p-5 md:grid-cols-2">
                        <label className="grid gap-2">
                            <span className="text-sm font-semibold">
                                العملة الرئيسية
                            </span>

                            <select
                                value={settings.currency}
                                onChange={(event) =>
                                    updateSetting(
                                        "currency",
                                        event.target.value as SystemSettings["currency"],
                                    )
                                }
                                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                            >
                                <option value="IQD">الدينار العراقي</option>
                            </select>
                        </label>

                        <label className="grid gap-2">
                            <span className="text-sm font-semibold">
                                مدة التأخر عن الدفع
                            </span>

                            <div className="relative">
                                <input
                                    type="number"
                                    min="1"
                                    value={settings.paymentDelayDays}
                                    onChange={(event) =>
                                        updateSetting(
                                            "paymentDelayDays",
                                            Number(event.target.value),
                                        )
                                    }
                                    className="w-full rounded-xl border border-slate-200 px-4 py-3 pl-16 text-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                                />

                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-slate-500">
                                    يومًا
                                </span>
                            </div>
                        </label>

                        <label className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-4 md:col-span-2">
                            <div>
                                <p className="text-sm font-semibold">
                                    تنبيهات انخفاض المخزون
                                </p>

                                <p className="mt-1 text-sm text-slate-500">
                                    إظهار تنبيه عندما تصل كمية المنتج إلى الحد الأدنى.
                                </p>
                            </div>

                            <input
                                type="checkbox"
                                checked={settings.lowStockNotifications}
                                onChange={(event) =>
                                    updateSetting(
                                        "lowStockNotifications",
                                        event.target.checked,
                                    )
                                }
                                className="size-5 accent-slate-900"
                            />
                        </label>
                    </div>
                </article>

                {/* المستخدمون والصلاحيات */}
                <article className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex items-center gap-3 border-b border-slate-200 p-5">
                        <div className="rounded-xl bg-violet-50 p-3 text-violet-700">
                            <UserCog size={21} />
                        </div>

                        <div>
                            <h4 className="font-bold">المستخدمون والصلاحيات</h4>
                            <p className="mt-1 text-sm text-slate-500">
                                سنستخدم هذا القسم لإدارة المديرين والموظفين لاحقًا.
                            </p>
                        </div>
                    </div>

                    <div className="p-5">
                        <div className="flex flex-col gap-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="font-semibold">حسابات الموظفين</p>
                                <p className="mt-1 text-sm text-slate-500">
                                    إضافة الموظفين وتحديد الأقسام التي يستطيع كل موظف فتحها.
                                </p>
                            </div>

                            <button
                                type="button"
                                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                            >
                                إدارة المستخدمين
                            </button>
                        </div>
                    </div>
                </article>

                {/* الحفظ */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                    {savedSuccessfully && (
                        <p className="text-sm font-semibold text-emerald-700">
                            تم حفظ الإعدادات محليًا بنجاح.
                        </p>
                    )}

                    <button
                        type="submit"
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
                    >
                        <Save size={18} />
                        <span>حفظ الإعدادات</span>
                    </button>
                </div>
            </form>
        </section>
    );
}

export default SettingsPage;