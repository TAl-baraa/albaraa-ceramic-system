function DashboardPage() {
    return (
        <>
            <section className="mb-6">
                <h3 className="text-2xl font-bold">مرحبًا بك، البراء</h3>
                <p className="mt-1 text-slate-500">
                    هذه هي الواجهة الأساسية لنظام إدارة معرض السيراميك.
                </p>
            </section>

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[
                    ["إجمالي المنتجات", "0"],
                    ["المنتجات المتوفرة", "0"],
                    ["العملاء", "0"],
                    ["حركات اليوم", "0"],
                ].map(([title, value]) => (
                    <article
                        key={title}
                        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                    >
                        <p className="text-sm text-slate-500">{title}</p>
                        <p className="mt-3 text-3xl font-bold">{value}</p>
                    </article>
                ))}
            </section>

            <section className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
                <article className="min-h-80 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h4 className="font-bold">آخر الحركات</h4>

                    <div className="flex min-h-60 items-center justify-center text-sm text-slate-400">
                        لا توجد حركات مسجلة بعد
                    </div>
                </article>

                <article className="min-h-80 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h4 className="font-bold">اختصارات سريعة</h4>

                    <div className="mt-5 grid gap-3">
                        <button
                            type="button"
                            className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
                        >
                            إضافة منتج جديد
                        </button>

                        <button
                            type="button"
                            className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold"
                        >
                            فتح قائمة المنتجات
                        </button>

                        <button
                            type="button"
                            className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold"
                        >
                            تسجيل حركة مخزون
                        </button>
                    </div>
                </article>
            </section>
        </>
    );
}

export default DashboardPage;