import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import AdminLayout from "./components/layout/AdminLayout";
import CustomersPage from "./pages/CustomersPage";
import CustomerStatementPage from "./pages/CustomerStatementPage";
import DashboardPage from "./pages/DashboardPage";
import InventoryPage from "./pages/InventoryPage";
import ProductsPage from "./pages/ProductsPage";
import NewSalePage from "./pages/NewSalePage";
import SaleDetailsPage from "./pages/SaleDetailsPage";
import SalesPage from "./pages/SalesPage";
import SettingsPage from "./pages/SettingsPage";
import ClearLocalDataPage from "./pages/ClearLocalDataPage";
import LoginPage from "./pages/LoginPage";
import { useAuth } from "./context/AuthContext";
import { ProductsProvider } from "./context/ProductsContext";
import { CustomersProvider } from "./context/CustomersContext";
import { SalesProvider } from "./context/SalesContext";
import { BusinessDataGate } from "./components/system/BusinessDataGate";

function ProtectedApplication() {
  const auth = useAuth();
  const location = useLocation();
  if (auth.loading) return <main className="grid min-h-screen place-items-center">جارٍ تحميل بيانات النظام...</main>;
  if (!auth.isAuthenticated) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return <ProductsProvider><CustomersProvider><SalesProvider><BusinessDataGate><Outlet /></BusinessDataGate></SalesProvider></CustomersProvider></ProductsProvider>;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route element={<ProtectedApplication />}>
      <Route element={<AdminLayout />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/sales" element={<SalesPage />} />
        <Route path="/sales/new" element={<NewSalePage />} />
        <Route
          path="/sales/:invoiceId"
          element={<SaleDetailsPage />}
        />
        <Route path="/customers" element={<CustomersPage />} />
        <Route
          path="/customers/:customerId/statement"
          element={<CustomerStatementPage />}
        />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/maintenance/clear-local-data" element={<ClearLocalDataPage />} />
      </Route>
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;
