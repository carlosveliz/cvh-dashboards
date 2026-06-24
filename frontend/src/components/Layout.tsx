import { LogOut, Settings } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";

export function Layout({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const onAdmin = location.pathname.startsWith("/admin");

  return (
    <div className={`min-h-screen ${dark ? "bg-institutional" : "bg-bg"}`}>
      <header className="sticky top-0 z-30 border-b border-white/10 bg-dark/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Link to="/" className="flex items-center gap-3">
            <span className="inline-flex items-center rounded-lg bg-white px-2.5 py-1.5 shadow-soft">
              <img src="/bionet-logo.png" alt="BioNet" className="h-6 w-auto" />
            </span>
            <span className="hidden text-lg font-semibold tracking-tight text-white sm:inline">
              Dashboards
            </span>
          </Link>

          <nav className="flex items-center gap-1.5 text-white">
            {user?.role === "admin" && (
              <Link
                to="/admin"
                title="Administración"
                aria-label="Administración"
                className={`btn p-2.5 text-white hover:bg-white/10 ${
                  onAdmin ? "bg-white/10" : ""
                }`}
              >
                <Settings className="h-4 w-4" />
              </Link>
            )}
            <div className="mx-1.5 hidden text-right sm:block">
              <div className="text-sm font-semibold text-white">
                {user?.display_name || user?.email}
              </div>
              <div className="text-xs capitalize text-accent">{user?.role}</div>
            </div>
            <button
              onClick={() => logout()}
              className="btn p-2.5 text-white hover:bg-white/10"
              title="Cerrar sesión"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8">{children}</main>
    </div>
  );
}
