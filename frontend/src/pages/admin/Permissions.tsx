import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../../api/client";
import type { Dashboard, User } from "../../api/types";
import { FullSpinner, Spinner } from "../../components/ui";

export default function AdminPermissions() {
  const qc = useQueryClient();
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

  const perms = useQuery({
    queryKey: ["dashboard-perms", selected],
    enabled: !!selected,
    queryFn: async () =>
      (await api.get<string[]>(`/api/dashboards/${selected}/permissions`)).data,
  });

  useEffect(() => {
    if (perms.data) setGranted(new Set(perms.data));
  }, [perms.data]);

  // Default to first dashboard once loaded.
  useEffect(() => {
    if (!selected && dashboards.data && dashboards.data.length > 0) {
      setSelected(dashboards.data[0].id);
    }
  }, [dashboards.data, selected]);

  const save = useMutation({
    mutationFn: async () =>
      api.put(`/api/dashboards/${selected}/permissions`, { ids: Array.from(granted) }),
    onSuccess: () => {
      setSaved(true);
      qc.invalidateQueries({ queryKey: ["dashboard-perms", selected] });
      setTimeout(() => setSaved(false), 2000);
    },
  });

  function toggle(userId: string) {
    setGranted((prev) => {
      const next = new Set(prev);
      next.has(userId) ? next.delete(userId) : next.add(userId);
      return next;
    });
  }

  if (dashboards.isLoading || users.isLoading) return <FullSpinner />;

  const regularUsers = users.data?.filter((u) => u.role !== "admin") ?? [];

  return (
    <div className="space-y-5">
      <div className="card p-5">
        <label className="label">Dashboard</label>
        <select
          className="input max-w-md"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          {dashboards.data?.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <p className="mt-2 text-sm text-muted-fg">
          Marca los usuarios que pueden ver este dashboard. Los administradores ven todo
          automáticamente.
        </p>
      </div>

      {selected && (
        <div className="card overflow-hidden">
          {perms.isLoading ? (
            <div className="p-8">
              <FullSpinner />
            </div>
          ) : regularUsers.length === 0 ? (
            <div className="p-8 text-center text-muted-fg">
              No hay usuarios (no administradores) a quienes asignar acceso.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {regularUsers.map((u) => {
                const on = granted.has(u.id);
                return (
                  <li key={u.id}>
                    <button
                      onClick={() => toggle(u.id)}
                      className="flex w-full items-center justify-between px-5 py-3.5 text-left hover:bg-muted"
                    >
                      <div>
                        <div className="font-medium text-fg">{u.display_name || u.email}</div>
                        <div className="text-sm text-muted-fg">{u.email}</div>
                      </div>
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-md border ${
                          on ? "border-primary bg-primary text-primary-fg" : "border-border bg-surface"
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
          <div className="flex items-center justify-end gap-3 border-t border-border bg-muted/40 px-5 py-3">
            {saved && <span className="text-sm text-success">Guardado</span>}
            <button
              className="btn-primary"
              onClick={() => save.mutate()}
              disabled={save.isPending}
            >
              {save.isPending ? <Spinner className="border-primary-fg" /> : <Save className="h-4 w-4" />}
              Guardar permisos
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
