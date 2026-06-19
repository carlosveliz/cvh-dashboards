import { useQuery } from "@tanstack/react-query";
import { FileSpreadsheet, LayoutDashboard } from "lucide-react";
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

export default function Home() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboards"],
    queryFn: async () => (await api.get<Dashboard[]>("/api/dashboards")).data,
  });

  return (
    <Layout>
      <div className="mb-8">
        <h1 className="font-display text-3xl font-semibold text-fg">Tus dashboards</h1>
        <p className="mt-1 text-muted-fg">Selecciona un reporte para abrirlo.</p>
      </div>

      {isLoading ? (
        <FullSpinner />
      ) : !data || data.length === 0 ? (
        <div className="card flex flex-col items-center justify-center px-6 py-20 text-center">
          <LayoutDashboard className="h-10 w-10 text-muted-fg" />
          <p className="mt-4 text-fg">Aún no tienes dashboards disponibles.</p>
          <p className="text-sm text-muted-fg">
            El administrador te dará acceso cuando estén listos.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((d) => (
            <Link
              key={d.id}
              to={`/d/${d.id}`}
              className="card group flex flex-col p-5 transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div className="mb-4 flex items-start justify-between">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                    d.type === "excel"
                      ? "bg-accent-soft text-accent"
                      : "bg-primary-soft text-primary"
                  }`}
                >
                  {d.type === "excel" ? (
                    <FileSpreadsheet className="h-6 w-6" />
                  ) : (
                    <LayoutDashboard className="h-6 w-6" />
                  )}
                </div>
                <TypeBadge type={d.type} />
              </div>
              <h3 className="font-medium text-fg group-hover:text-primary">{d.name}</h3>
              {d.description && (
                <p className="mt-1 line-clamp-2 text-sm text-muted-fg">{d.description}</p>
              )}
              <div className="mt-auto pt-4 text-xs text-muted-fg">
                Actualizado {timeAgo(d.uploaded_at)}
              </div>
            </Link>
          ))}
        </div>
      )}
    </Layout>
  );
}
