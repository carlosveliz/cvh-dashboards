import { useQuery } from "@tanstack/react-query";
import { FileSpreadsheet, LayoutDashboard, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { Dashboard } from "../api/types";
import { Layout } from "../components/Layout";
import { FullSpinner, TypeBadge } from "../components/ui";

function timeAgo(iso: string | null): string {
  if (!iso) return "sin contenido";
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days > 0) return `hace ${days} d`;
  const hours = Math.floor(diff / 3600000);
  if (hours > 0) return `hace ${hours} h`;
  const min = Math.floor(diff / 60000);
  return min > 0 ? `hace ${min} min` : "recién";
}

function DashboardCard({ d }: { d: Dashboard }) {
  const isExcel = d.type === "excel";
  return (
    <Link
      to={`/d/${d.id}`}
      className="glass group flex flex-col p-5 text-white transition duration-200 hover:-translate-y-1 hover:border-white/30 hover:shadow-glow"
    >
      <div className="mb-4 flex items-start justify-between">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-xl ${
            isExcel ? "bg-accent/20 text-accent" : "bg-primary/25 text-white"
          }`}
        >
          {isExcel ? (
            <FileSpreadsheet className="h-6 w-6" />
          ) : (
            <LayoutDashboard className="h-6 w-6" />
          )}
        </div>
        <span
          className={`badge ${
            isExcel ? "bg-accent/20 text-accent" : "bg-white/10 text-white"
          }`}
        >
          {isExcel ? "Excel" : "HTML"}
        </span>
      </div>
      <h3 className="font-semibold tracking-tight text-white group-hover:text-accent">
        {d.name}
      </h3>
      {d.description && (
        <p className="mt-1 line-clamp-2 text-sm text-dark-muted-fg">{d.description}</p>
      )}
      <div className="mt-auto pt-4 text-xs text-dark-muted-fg">
        Actualizado {timeAgo(d.uploaded_at)}
      </div>
    </Link>
  );
}

export default function Home() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboards"],
    queryFn: async () => (await api.get<Dashboard[]>("/api/dashboards")).data,
  });
  const [q, setQ] = useState("");

  // Filter by search, then group by group_name (null -> "General").
  const groups = useMemo(() => {
    const term = q.trim().toLowerCase();
    const filtered = (data ?? []).filter(
      (d) =>
        !term ||
        d.name.toLowerCase().includes(term) ||
        (d.description ?? "").toLowerCase().includes(term),
    );
    const map = new Map<string, Dashboard[]>();
    for (const d of filtered) {
      const key = d.group_name?.trim() || "General";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(d);
    }
    // Sort group names, keep "General" last.
    return [...map.entries()].sort(([a], [b]) => {
      if (a === "General") return 1;
      if (b === "General") return -1;
      return a.localeCompare(b);
    });
  }, [data, q]);

  return (
    <Layout dark>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Tus dashboards</h1>
          <p className="mt-1 font-light text-dark-muted-fg">
            Selecciona un reporte para abrirlo.
          </p>
        </div>
        {data && data.length > 0 && (
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-muted-fg" />
            <input
              className="w-full rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5 pl-9 text-sm text-white outline-none transition placeholder:text-dark-muted-fg focus:border-accent focus:ring-2 focus:ring-accent/30"
              placeholder="Buscar dashboard…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        )}
      </div>

      {isLoading ? (
        <FullSpinner />
      ) : !data || data.length === 0 ? (
        <div className="glass flex flex-col items-center justify-center px-6 py-20 text-center text-white">
          <LayoutDashboard className="h-10 w-10 text-accent" />
          <p className="mt-4">Aún no tienes dashboards disponibles.</p>
          <p className="text-sm font-light text-dark-muted-fg">
            El administrador te dará acceso cuando estén listos.
          </p>
        </div>
      ) : groups.length === 0 ? (
        <div className="glass px-6 py-16 text-center font-light text-dark-muted-fg">
          No hay dashboards que coincidan con "{q}".
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map(([group, items]) => (
            <section key={group}>
              {/* Only show the group header when there's more than one group. */}
              {groups.length > 1 && (
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-accent">
                  {group}
                </h2>
              )}
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((d) => (
                  <DashboardCard key={d.id} d={d} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </Layout>
  );
}
