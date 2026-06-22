import { LayoutGrid, LogOut, Settings } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const onAdmin = location.pathname.startsWith("/admin");

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-30 border-b border-border bg-surface/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-fg shadow-soft">
              <LayoutGrid className="h-5 w-5" />
            </div>
            <span className="font-display text-lg font-semibold text-fg">
              CVH Dashboards
            </span>
          </Link>

          <nav className="flex items-center gap-1.5">
            {user?.role === "admin" && (
              <Link
                to="/admin"
                title="Administración"
                aria-label="Administración"
                className={`btn-ghost p-2.5 ${onAdmin ? "bg-muted" : ""}`}
              >
                <Settings className="h-4 w-4" />
              </Link>
            )}
            <div className="mx-1.5 hidden text-right sm:block">
              <div className="text-sm font-medium text-fg">
                {user?.display_name || user?.email}
              </div>
              <div className="text-xs text-muted-fg capitalize">{user?.role}</div>
            </div>
            <button onClick={() => logout()} className="btn-ghost p-2.5" title="Cerrar sesión">
              <LogOut className="h-4 w-4" />
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8">{children}</main>
    </div>
  );
}
