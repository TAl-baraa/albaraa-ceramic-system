import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

function NewSalePage() {
    const navigate = useNavigate();

    return (
        <section className="mx-auto max-w-3xl">
            <button
                type="button"
                onClick={() => navigate("/sales")}
                className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
            >
                <ArrowRight size={18} />
                العودة إلى المبيعات
            </button>
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-2xl font-bold">
                    فاتورة بيع جديدة
                </h3>
                <p className="mt-3 leading-7 text-slate-500">
                    سيتم تنفيذ إنشاء الفاتورة وإضافة المنتجات والمدفوعات
                    في المرحلة القادمة.
                </p>
            </div>
        </section>
    );
}

export default NewSalePage;
