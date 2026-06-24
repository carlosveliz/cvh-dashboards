import { Navigate, Route, Routes } from "react-router-dom";
import { FullSpinner } from "./components/ui";
import { useAuth } from "./lib/auth";
import AcceptInvite from "./pages/AcceptInvite";
import DashboardViewer from "./pages/DashboardViewer";
import ForgotPassword from "./pages/ForgotPassword";
import Home from "./pages/Home";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminAudit from "./pages/admin/Audit";
import AdminDashboards from "./pages/admin/Dashboards";
import AdminFolders from "./pages/admin/Folders";
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
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

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
        <Route path="folders" element={<AdminFolders />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="permissions" element={<AdminPermissions />} />
        <Route path="audit" element={<AdminAudit />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
