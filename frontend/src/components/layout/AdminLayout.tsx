import {
    Boxes,
    ChevronDown,
    LayoutDashboard,
    Menu,
    Package,
    ReceiptText,
    Settings,
    Users,
    Warehouse,
} from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

const menuItems = [
    {
        label: "لوحة التحكم",
        path: "/dashboard",
        icon: LayoutDashboard,
    },
    {
        label: "المنتجات",
        path: "/products",
        icon: Package,
    },
    {
        label: "المخزون",
        path: "/inventory",
        icon: Warehouse,
    },
    {
        label: "المبيعات",
        path: "/sales",
        icon: ReceiptText,
    },
    {
        label: "العملاء",
        path: "/customers",
        icon: Users,
    },
    {
        label: "الإعدادات",
        path: "/settings",
        icon: Settings,
    },
];

const pageTitles: Record<string, { title: string; description: string }> = {
    "/dashboard": {
        title: "لوحة التحكم",
        description: "نظرة عامة على نشاط المعرض",
    },
    "/products": {
        title: "المنتجات",
        description: "إدارة منتجات السيراميك والأسعار",
    },
    "/inventory": {
        title: "المخزون",
        description: "متابعة الكميات وحركات المخزون",
    },
    "/sales": {
        title: "المبيعات",
        description: "إدارة فواتير البيع والمدفوعات",
    },
    "/customers": {
        title: "العملاء",
        description: "إدارة بيانات العملاء وحساباتهم",
    },
    "/settings": {
        title: "الإعدادات",
        description: "إعدادات النظام والمستخدمين",
    },
};

function AdminLayout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const location = useLocation();

    const currentPage =
        pageTitles[location.pathname] ??
        (location.pathname.startsWith("/sales/")
            ? pageTitles["/sales"]
            : location.pathname.startsWith("/customers/")
              ? pageTitles["/customers"]
            : pageTitles["/dashboard"]);

    return (
        <div dir="rtl" className="min-h-screen bg-slate-100 text-slate-900">
            <div className="flex min-h-screen">
                <aside
                    className={[
                        "app-sidebar fixed inset-y-0 right-0 z-40 w-72 border-l border-slate-200 bg-white transition-transform duration-300 lg:static lg:translate-x-0",
                        sidebarOpen ? "translate-x-0" : "translate-x-full",
                    ].join(" ")}
                >
                    <div className="flex h-20 items-center gap-3 border-b border-slate-200 px-6">
                        <div className="flex size-11 items-center justify-center rounded-2xl bg-slate-900 text-white">
                            <Boxes size={22} />
                        </div>

                        <div>
                            <h1 className="text-base font-bold">معرض البراء</h1>
                            <p className="text-sm text-slate-500">نظام إدارة السيراميك</p>
                        </div>
                    </div>

                    <nav className="app-navigation space-y-2 p-4">
                        {menuItems.map((item) => {
                            const Icon = item.icon;

                            return (
                                <NavLink
                                    key={item.path}
                                    to={item.path}
                                    onClick={() => setSidebarOpen(false)}
                                    className={({ isActive }) =>
                                        [
                                            "flex w-full items-center gap-3 rounded-xl px-4 py-3 text-right text-sm font-medium transition",
                                            isActive
                                                ? "bg-slate-900 text-white"
                                                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                                        ].join(" ")
                                    }
                                >
                                    <Icon size={20} />
                                    <span>{item.label}</span>
                                </NavLink>
                            );
                        })}
                    </nav>
                </aside>

                {sidebarOpen && (
                    <button
                        type="button"
                        aria-label="إغلاق القائمة"
                        className="fixed inset-0 z-30 bg-slate-950/40 lg:hidden"
                        onClick={() => setSidebarOpen(false)}
                    />
                )}

                <div className="flex min-w-0 flex-1 flex-col">
                    <header className="app-header flex h-20 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 lg:px-8">
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                aria-label="فتح القائمة"
                                className="rounded-xl border border-slate-200 p-2.5 text-slate-600 lg:hidden"
                                onClick={() => setSidebarOpen(true)}
                            >
                                <Menu size={21} />
                            </button>

                            <div>
                                <h2 className="text-lg font-bold">{currentPage.title}</h2>
                                <p className="hidden text-sm text-slate-500 sm:block">
                                    {currentPage.description}
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 text-right"
                        >
                            <div className="flex size-10 items-center justify-center rounded-full bg-slate-900 font-bold text-white">
                                ب
                            </div>

                            <div className="hidden sm:block">
                                <p className="text-sm font-semibold">البراء طه</p>
                                <p className="text-xs text-slate-500">مدير النظام</p>
                            </div>

                            <ChevronDown size={17} className="text-slate-400" />
                        </button>
                    </header>

                    <main className="flex-1 p-4 sm:p-6 lg:p-8">
                        <Outlet />
                    </main>
                </div>
            </div>
        </div>
    );
}

export default AdminLayout;
