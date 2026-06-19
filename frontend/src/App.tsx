import { Navigate, Route, Routes } from "react-router-dom";
import { FullSpinner } from "./components/ui";
import { useAuth } from "./lib/auth";
import AcceptInvite from "./pages/AcceptInvite";
import DashboardViewer from "./pages/DashboardViewer";
import Home from "./pages/Home";
import Login from "./pages/Login";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboards from "./pages/admin/Dashboards";
import AdminPermissions from "./pages/admin/Permissions";
import AdminUsers from "./pages/admin/Users";
import type { ReactNode } from "react";

function Protected({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="flex h-screen items-center justify-center">
        <FullSpinner />
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  if (admin && user.role !== "admin") return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/accept-invite" element={<AcceptInvite />} />

      <Route
        path="/"
        element={
          <Protected>
            <Home />
          </Protected>
        }
      />
      <Route
        path="/d/:id"
        element={
          <Protected>
            <DashboardViewer />
          </Protected>
        }
      />

      <Route
        path="/admin"
        element={
          <Protected admin>
            <AdminLayout />
          </Protected>
        }
      >
        <Route index element={<Navigate to="/admin/dashboards" replace />} />
        <Route path="dashboards" element={<AdminDashboards />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="permissions" element={<AdminPermissions />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
