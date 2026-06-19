import { KeyRound, LayoutDashboard, Users } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { Layout } from "../../components/Layout";

const tabs = [
  { to: "/admin/dashboards", label: "Dashboards", icon: LayoutDashboard },
  { to: "/admin/users", label: "Usuarios", icon: Users },
  { to: "/admin/permissions", label: "Permisos", icon: KeyRound },
];

export default function AdminLayout() {
  return (
    <Layout>
      <div className="mb-7">
        <h1 className="font-display text-3xl font-semibold text-fg">Administración</h1>
        <p className="mt-1 text-muted-fg">Gestiona dashboards, usuarios y accesos.</p>
      </div>

      <div className="mb-7 inline-flex gap-1 rounded-xl border border-border bg-surface p-1 shadow-soft">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            className={({ isActive }) =>
              `flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
                isActive ? "bg-primary text-primary-fg" : "text-muted-fg hover:bg-muted"
              }`
            }
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </NavLink>
        ))}
      </div>

      <Outlet />
    </Layout>
  );
}
