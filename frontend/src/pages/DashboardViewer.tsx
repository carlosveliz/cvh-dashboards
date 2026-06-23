import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import type { ContentToken, Dashboard } from "../api/types";
import { ExcelView } from "../components/ExcelView";
import { FullSpinner } from "../components/ui";

export default function DashboardViewer() {
  const { id = "" } = useParams();

  const meta = useQuery({
    queryKey: ["dashboard", id],
    queryFn: async () => (await api.get<Dashboard>(`/api/dashboards/${id}`)).data,
  });

  const token = useQuery({
    queryKey: ["content-token", id],
    enabled: meta.data?.type === "static_html" && meta.data?.has_content,
    queryFn: async () =>
      (await api.get<ContentToken>(`/api/dashboards/${id}/content-token`)).data,
  });

  const d = meta.data;

  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-white/10 bg-dark px-4 text-white">
        <Link
          to="/"
          className="btn p-2 text-white hover:bg-white/10"
          title="Volver"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate font-semibold tracking-tight text-white">
              {d?.name || "Cargando…"}
            </h1>
            {d && (
              <span
                className={`badge ${
                  d.type === "excel" ? "bg-accent/20 text-accent" : "bg-white/10 text-white"
                }`}
              >
                {d.type === "excel" ? "Excel" : "HTML"}
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-auto bg-bg">
        {meta.isLoading ? (
          <FullSpinner />
        ) : meta.error || !d ? (
          <p className="p-8 text-center text-danger">No se pudo cargar el dashboard.</p>
        ) : !d.has_content ? (
          <p className="p-8 text-center text-muted-fg">
            Este dashboard aún no tiene contenido subido.
          </p>
        ) : d.type === "excel" ? (
          <ExcelView dashboardId={id} />
        ) : token.isLoading || !token.data ? (
          <FullSpinner />
        ) : (
          <iframe
            title={d.name}
            src={token.data.src}
            className="h-full w-full border-0 bg-white"
            sandbox="allow-scripts allow-popups allow-forms allow-downloads allow-modals"
          />
        )}
      </div>
    </div>
  );
}
