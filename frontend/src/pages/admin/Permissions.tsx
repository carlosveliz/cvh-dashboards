import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, KeyRound, LayoutDashboard, Save, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../../api/client";
import type { Dashboard, User } from "../../api/types";
import { FullSpinner, Spinner, TypeBadge } from "../../components/ui";

type Mode = "dashboard" | "user";

export default function AdminPermissions() {
  const qc = useQueryClient();
  const [mode, setMode] = useState<Mode>("dashboard");
  const [selected, setSelected] = useState<string>("");
  const [granted, setGranted] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState(false);

  const dashboards = useQuery({
    queryKey: ["admin-dashboards"],
    queryFn: async () => (await api.get<Dashboard[]>("/api/dashboards")).data,
  });
  const users = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => (await api.get<User[]>("/api/users")).data,
  });

  // The endpoint differs by mode: a dashboard's user-grants, or a user's dashboard-grants.
  const permsPath =
    mode === "dashboard"
      ? `/api/dashboards/${selected}/permissions`
      : `/api/users/${selected}/permissions`;

  const perms = useQuery({
    queryKey: ["perms", mode, selected],
    enabled: !!selected,
    queryFn: async () => (await api.get<string[]>(permsPath)).data,
  });

  useEffect(() => {
    if (perms.data) setGranted(new Set(perms.data));
  }, [perms.data]);

  // The list of things you pick from (left selector).
  const subjects =
    mode === "dashboard"
      ? (dashboards.data ?? []).map((d) => ({ id: d.id, label: d.name }))
      : (users.data ?? [])
          .filter((u) => u.role !== "admin")
          .map((u) => ({ id: u.id, label: u.display_name || u.email }));

  // Default selection to the first subject when the list or mode changes.
  useEffect(() => {
    if (subjects.length > 0 && !subjects.some((s) => s.id === selected)) {
      setSelected(subjects[0].id);
    }
    if (subjects.length === 0) setSelected("");
  }, [mode, dashboards.data, users.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = useMutation({
    mutationFn: async () => api.put(permsPath, { ids: Array.from(granted) }),
    onSuccess: () => {
      setSaved(true);
      qc.invalidateQueries({ queryKey: ["perms", mode, selected] });
      setTimeout(() => setSaved(false), 2000);
    },
  });

  function toggle(id: string) {
    setGranted((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function switchMode(m: Mode) {
    if (m === mode) return;
    setMode(m);
    setSelected("");
    setGranted(new Set());
  }

  if (dashboards.isLoading || users.isLoading) return <FullSpinner />;

  // The list of toggleable targets (right side).
  const targets: { id: string; title: string; subtitle: string; badge?: Dashboard["type"] }[] =
    mode === "dashboard"
      ? (users.data ?? [])
          .filter((u) => u.role !== "admin")
          .map((u) => ({ id: u.id, title: u.display_name || u.email, subtitle: u.email }))
      : (dashboards.data ?? []).map((d) => ({
          id: d.id,
          title: d.name,
          subtitle: d.description || (d.type === "excel" ? "Excel" : "HTML"),
          badge: d.type,
        }));

  const selectorLabel = mode === "dashboard" ? "Dashboard" : "Usuario";
  const grantedCount = granted.size;

  return (
    <div className="space-y-5">
      {/* Mode toggle */}
      <div className="inline-flex gap-1 rounded-xl border border-border bg-surface p-1 shadow-soft">
        <button
          onClick={() => switchMode("dashboard")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
            mode === "dashboard" ? "bg-primary text-primary-fg" : "text-muted-fg hover:bg-muted"
          }`}
        >
          <LayoutDashboard className="h-4 w-4" />
          Por dashboard
        </button>
        <button
          onClick={() => switchMode("user")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
            mode === "user" ? "bg-primary text-primary-fg" : "text-muted-fg hover:bg-muted"
          }`}
        >
          <Users className="h-4 w-4" />
          Por usuario
        </button>
      </div>

      <div className="card p-5">
        <label className="label">{selectorLabel}</label>
        {subjects.length === 0 ? (
          <p className="text-sm text-muted-fg">
            {mode === "dashboard"
              ? "No hay dashboards todavía."
              : "No hay usuarios (no administradores) a quienes asignar acceso."}
          </p>
        ) : (
          <select
            className="input max-w-md"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        )}
        <p className="mt-2 text-sm text-muted-fg">
          {mode === "dashboard"
            ? "Marca los usuarios que pueden ver este dashboard."
            : "Marca los dashboards que este usuario puede ver."}{" "}
          Los administradores ven todo automáticamente.
        </p>
      </div>

      {selected && (
        <div className="card overflow-hidden">
          {perms.isLoading ? (
            <div className="p-8">
              <FullSpinner />
            </div>
          ) : targets.length === 0 ? (
            <div className="p-8 text-center text-muted-fg">
              {mode === "dashboard"
                ? "No hay usuarios a quienes asignar acceso."
                : "No hay dashboards para asignar."}
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {targets.map((t) => {
                const on = granted.has(t.id);
                return (
                  <li key={t.id}>
                    <button
                      onClick={() => toggle(t.id)}
                      className="flex w-full items-center justify-between px-5 py-3.5 text-left hover:bg-muted"
                    >
                      <div className="flex items-center gap-2.5">
                        <div>
                          <div className="flex items-center gap-2 font-medium text-fg">
                            {t.title}
                            {t.badge && <TypeBadge type={t.badge} />}
                          </div>
                          <div className="text-sm text-muted-fg">{t.subtitle}</div>
                        </div>
                      </div>
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-md border ${
                          on
                            ? "border-primary bg-primary text-primary-fg"
                            : "border-border bg-surface"
                        }`}
                      >
                        {on && <Check className="h-4 w-4" />}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="flex items-center justify-between gap-3 border-t border-border bg-muted/40 px-5 py-3">
            <span className="flex items-center gap-1.5 text-sm text-muted-fg">
              <KeyRound className="h-3.5 w-3.5" />
              {grantedCount} con acceso
            </span>
            <div className="flex items-center gap-3">
              {saved && <span className="text-sm text-success">Guardado</span>}
              <button className="btn-primary" onClick={() => save.mutate()} disabled={save.isPending}>
                {save.isPending ? (
                  <Spinner className="border-primary-fg" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
