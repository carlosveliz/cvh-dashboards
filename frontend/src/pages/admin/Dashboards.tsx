import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { History, Plus, RotateCcw, Trash2, Upload } from "lucide-react";
import { FormEvent, useRef, useState } from "react";
import { api } from "../../api/client";
import type { Dashboard, DashboardType, DashboardVersion, Visibility } from "../../api/types";
import { ErrorText, FullSpinner, Modal, Spinner, TypeBadge } from "../../components/ui";

const VISIBILITIES: { value: Visibility; label: string }[] = [
  { value: "restricted", label: "Restringido" },
  { value: "internal", label: "Interno" },
  { value: "external", label: "Externo" },
  { value: "personal", label: "Personal (solo admin)" },
];

export default function AdminDashboards() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [versionsFor, setVersionsFor] = useState<Dashboard | null>(null);
  const [uploadError, setUploadError] = useState<Record<string, string>>({});
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["admin-dashboards"],
    queryFn: async () => (await api.get<Dashboard[]>("/api/dashboards")).data,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/api/dashboards/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-dashboards"] }),
  });

  const upload = useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      const form = new FormData();
      form.append("file", file);
      return api.post(`/api/dashboards/${id}/upload`, form);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-dashboards"] }),
  });

  function onPickFile(d: Dashboard, file?: File) {
    if (!file) return;
    setUploadError((e) => ({ ...e, [d.id]: "" }));
    upload.mutate(
      { id: d.id, file },
      {
        onError: (err: any) =>
          setUploadError((e) => ({
            ...e,
            [d.id]: err?.response?.data?.detail || "Error al subir",
          })),
      },
    );
  }

  if (isLoading) return <FullSpinner />;

  return (
    <div>
      <div className="mb-5 flex justify-end">
        <button className="btn-primary" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" /> Nuevo dashboard
        </button>
      </div>

      <div className="space-y-3">
        {data?.length === 0 && (
          <div className="card p-10 text-center text-muted-fg">
            Aún no hay dashboards. Crea el primero.
          </div>
        )}
        {data?.map((d) => (
          <div key={d.id} className="card flex flex-wrap items-center gap-4 p-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-fg">{d.name}</span>
                <TypeBadge type={d.type} />
                <span className="badge bg-muted text-muted-fg">{d.visibility}</span>
              </div>
              <div className="mt-0.5 text-sm text-muted-fg">
                {d.has_content ? `Archivo: ${d.file_name}` : "Sin contenido"}
              </div>
              {uploadError[d.id] && <ErrorText>{uploadError[d.id]}</ErrorText>}
            </div>

            <input
              type="file"
              hidden
              ref={(el) => (fileInputs.current[d.id] = el)}
              accept={d.type === "excel" ? ".xlsx" : ".html,.htm"}
              onChange={(e) => onPickFile(d, e.target.files?.[0])}
            />
            <button
              className="btn-outline"
              onClick={() => fileInputs.current[d.id]?.click()}
              disabled={upload.isPending}
            >
              {upload.isPending && upload.variables?.id === d.id ? (
                <Spinner />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Subir {d.type === "excel" ? ".xlsx" : ".html"}
            </button>
            <button
              className="btn-ghost p-2.5"
              onClick={() => setVersionsFor(d)}
              disabled={!d.has_content}
              title="Versiones"
            >
              <History className="h-4 w-4" />
            </button>
            <button
              className="btn-ghost p-2.5 text-danger"
              onClick={() => {
                if (confirm(`¿Eliminar "${d.name}"?`)) remove.mutate(d.id);
              }}
              title="Eliminar"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <CreateModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => {
          setShowCreate(false);
          qc.invalidateQueries({ queryKey: ["admin-dashboards"] });
        }}
      />

      <VersionsModal
        dashboard={versionsFor}
        onClose={() => setVersionsFor(null)}
        onRestored={() => qc.invalidateQueries({ queryKey: ["admin-dashboards"] })}
      />
    </div>
  );
}

function fmtSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function VersionsModal({
  dashboard,
  onClose,
  onRestored,
}: {
  dashboard: Dashboard | null;
  onClose: () => void;
  onRestored: () => void;
}) {
  const qc = useQueryClient();
  const id = dashboard?.id;

  const versions = useQuery({
    queryKey: ["dashboard-versions", id],
    enabled: !!id,
    queryFn: async () =>
      (await api.get<DashboardVersion[]>(`/api/dashboards/${id}/versions`)).data,
  });

  const restore = useMutation({
    mutationFn: async (versionId: string) =>
      api.post(`/api/dashboards/${id}/versions/${versionId}/restore`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboard-versions", id] });
      onRestored();
    },
  });

  return (
    <Modal open={!!dashboard} onClose={onClose} title={`Versiones — ${dashboard?.name ?? ""}`}>
      {versions.isLoading ? (
        <div className="py-8">
          <FullSpinner />
        </div>
      ) : !versions.data || versions.data.length === 0 ? (
        <p className="py-6 text-center text-muted-fg">Aún no hay versiones.</p>
      ) : (
        <ul className="divide-y divide-border">
          {versions.data.map((v) => (
            <li key={v.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-fg">v{v.version_no}</span>
                  {v.is_current && (
                    <span className="badge bg-success-soft text-success">Actual</span>
                  )}
                </div>
                <div className="truncate text-sm text-muted-fg">
                  {v.file_name || "—"} · {fmtSize(v.file_size)} ·{" "}
                  {new Date(v.uploaded_at).toLocaleString("es")}
                </div>
              </div>
              <button
                className="btn-outline shrink-0"
                disabled={v.is_current || restore.isPending}
                onClick={() => restore.mutate(v.id)}
              >
                {restore.isPending && restore.variables === v.id ? (
                  <Spinner />
                ) : (
                  <RotateCcw className="h-4 w-4" />
                )}
                Restaurar
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

function CreateModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<DashboardType>("static_html");
  const [visibility, setVisibility] = useState<Visibility>("restricted");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post("/api/dashboards", { name, description: description || null, type, visibility });
      setName("");
      setDescription("");
      setType("static_html");
      setVisibility("restricted");
      onCreated();
    } catch (err: any) {
      setError(err?.response?.data?.detail || "No se pudo crear");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nuevo dashboard">
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="label">Nombre</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className="label">Descripción (opcional)</label>
          <textarea
            className="input min-h-[72px]"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Tipo</label>
            <select
              className="input"
              value={type}
              onChange={(e) => setType(e.target.value as DashboardType)}
            >
              <option value="static_html">HTML estático</option>
              <option value="excel">Excel (.xlsx)</option>
            </select>
          </div>
          <div>
            <label className="label">Visibilidad</label>
            <select
              className="input"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as Visibility)}
            >
              {VISIBILITIES.map((v) => (
                <option key={v.value} value={v.value}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <ErrorText>{error}</ErrorText>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-outline" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? <Spinner className="border-primary-fg" /> : "Crear"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
