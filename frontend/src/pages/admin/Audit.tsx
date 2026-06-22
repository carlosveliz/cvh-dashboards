import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../../api/client";
import type { AuditEvent, AuditPage, AuditSummary, Dashboard, User } from "../../api/types";
import { FullSpinner } from "../../components/ui";

const PAGE_SIZE = 25;

// event_type -> human label + badge colour
const EVENTS: Record<string, { label: string; cls: string }> = {
  login_success: { label: "Inicio de sesión", cls: "bg-success-soft text-success" },
  login_failed: { label: "Login fallido", cls: "bg-danger-soft text-danger" },
  logout: { label: "Cierre de sesión", cls: "bg-muted text-muted-fg" },
  invite_accept: { label: "Invitación aceptada", cls: "bg-accent-soft text-accent" },
  dashboard_view: { label: "Vio dashboard", cls: "bg-primary-soft text-primary" },
  dashboard_create: { label: "Creó dashboard", cls: "bg-accent-soft text-accent" },
  dashboard_update: { label: "Editó dashboard", cls: "bg-accent-soft text-accent" },
  dashboard_delete: { label: "Borró dashboard", cls: "bg-danger-soft text-danger" },
  dashboard_upload: { label: "Subió archivo", cls: "bg-accent-soft text-accent" },
  access_set: { label: "Cambió accesos", cls: "bg-primary-soft text-primary" },
  user_create: { label: "Creó usuario", cls: "bg-accent-soft text-accent" },
  user_update: { label: "Editó usuario", cls: "bg-accent-soft text-accent" },
  user_delete: { label: "Borró usuario", cls: "bg-danger-soft text-danger" },
  invite_create: { label: "Envió invitación", cls: "bg-accent-soft text-accent" },
};

function EventBadge({ type }: { type: string }) {
  const e = EVENTS[type] ?? { label: type, cls: "bg-muted text-muted-fg" };
  return <span className={`badge ${e.cls}`}>{e.label}</span>;
}

function fmt(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("es", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-5">
      <div className="text-sm text-muted-fg">{label}</div>
      <div className="mt-1 font-display text-3xl font-semibold text-fg">{value}</div>
    </div>
  );
}

export default function AdminAudit() {
  const [eventType, setEventType] = useState("");
  const [userId, setUserId] = useState("");
  const [dashboardId, setDashboardId] = useState("");
  const [page, setPage] = useState(0);

  const summary = useQuery({
    queryKey: ["audit-summary"],
    queryFn: async () => (await api.get<AuditSummary>("/api/audit/summary")).data,
  });

  const users = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => (await api.get<User[]>("/api/users")).data,
  });

  const dashboards = useQuery({
    queryKey: ["admin-dashboards"],
    queryFn: async () => (await api.get<Dashboard[]>("/api/dashboards")).data,
  });

  const events = useQuery({
    queryKey: ["audit", eventType, userId, dashboardId, page],
    queryFn: async () => {
      const params: Record<string, string | number> = {
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      };
      if (eventType) params.event_type = eventType;
      if (userId) params.user_id = userId;
      if (dashboardId) params.dashboard_id = dashboardId;
      return (await api.get<AuditPage>("/api/audit", { params })).data;
    },
  });

  function resetTo(setter: (v: string) => void, value: string) {
    setter(value);
    setPage(0);
  }

  const userEmail = (id: string | null) =>
    users.data?.find((u) => u.id === id)?.email ?? null;

  const total = events.data?.total ?? 0;
  const maxPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);

  return (
    <div className="space-y-6">
      {/* Summary */}
      {summary.data && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <SummaryCard label="Inicios de sesión (7d)" value={summary.data.logins_7d} />
          <SummaryCard label="Usuarios activos (7d)" value={summary.data.active_users_7d} />
          <SummaryCard label="Logins fallidos (7d)" value={summary.data.failed_logins_7d} />
          <div className="card p-5">
            <div className="text-sm text-muted-fg">Dashboards más vistos (7d)</div>
            {summary.data.top_dashboards.length === 0 ? (
              <div className="mt-1 text-sm text-muted-fg">Sin vistas aún</div>
            ) : (
              <ul className="mt-2 space-y-1 text-sm">
                {summary.data.top_dashboards.slice(0, 3).map((d) => (
                  <li key={d.id} className="flex justify-between gap-2">
                    <span className="truncate text-fg">{d.name}</span>
                    <span className="shrink-0 text-muted-fg">{d.views}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label">Evento</label>
          <select
            className="input"
            value={eventType}
            onChange={(e) => resetTo(setEventType, e.target.value)}
          >
            <option value="">Todos</option>
            {Object.entries(EVENTS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Usuario</label>
          <select
            className="input"
            value={userId}
            onChange={(e) => resetTo(setUserId, e.target.value)}
          >
            <option value="">Todos</option>
            {users.data?.map((u) => (
              <option key={u.id} value={u.id}>
                {u.email}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Dashboard</label>
          <select
            className="input"
            value={dashboardId}
            onChange={(e) => resetTo(setDashboardId, e.target.value)}
          >
            <option value="">Todos</option>
            {dashboards.data?.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {events.isLoading ? (
          <div className="p-8">
            <FullSpinner />
          </div>
        ) : !events.data || events.data.items.length === 0 ? (
          <div className="p-12 text-center text-muted-fg">
            No hay actividad que coincida con los filtros.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-muted-fg">
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Usuario</th>
                <th className="px-4 py-3 font-medium">Evento</th>
                <th className="px-4 py-3 font-medium">Objetivo</th>
                <th className="px-4 py-3 font-medium">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {events.data.items.map((ev: AuditEvent) => (
                <tr key={ev.id} className="hover:bg-muted/40">
                  <td className="whitespace-nowrap px-4 py-3 text-muted-fg">
                    {fmt(ev.created_at)}
                  </td>
                  <td className="px-4 py-3 text-fg">
                    {ev.actor_email || userEmail(ev.user_id) || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <EventBadge type={ev.event_type} />
                  </td>
                  <td className="px-4 py-3 text-muted-fg">{ev.target_label || "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-fg">{ev.ip || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t border-border bg-muted/40 px-4 py-3 text-sm">
            <span className="text-muted-fg">
              {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} de {total}
            </span>
            <div className="flex gap-2">
              <button
                className="btn-ghost"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Anterior
              </button>
              <button
                className="btn-ghost"
                disabled={page >= maxPage}
                onClick={() => setPage((p) => Math.min(maxPage, p + 1))}
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
