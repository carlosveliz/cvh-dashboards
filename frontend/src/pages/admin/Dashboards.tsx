import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  FolderOpen,
  GripVertical,
  History,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
} from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { api } from "../../api/client";
import type {
  ChartType,
  Dashboard,
  DashboardType,
  DashboardVersion,
  ExcelData,
  Folder,
  Visibility,
} from "../../api/types";
import { ErrorText, FullSpinner, Modal, Spinner, TypeBadge } from "../../components/ui";

const VISIBILITY_LABELS: Record<Visibility, string> = {
  restricted: "Restringido",
  internal: "Interno",
  external: "Externo",
  personal: "Personal (solo admin)",
};

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
  const [chartFor, setChartFor] = useState<Dashboard | null>(null);
  const [editing, setEditing] = useState<Dashboard | null>(null);
  const [uploadError, setUploadError] = useState<Record<string, string>>({});
  const [dragId, setDragId] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string>("");
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["admin-dashboards"],
    queryFn: async () => (await api.get<Dashboard[]>("/api/dashboards")).data,
  });

  // Folders for the assign/move dropdowns (managed in the Carpetas tab).
  const { data: folders } = useQuery({
    queryKey: ["admin-folders"],
    queryFn: async () => (await api.get<Folder[]>("/api/folders")).data,
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

  // Drag-and-drop: move a dashboard to the folder it's dropped on.
  const move = useMutation({
    mutationFn: async ({ id, folderId }: { id: string; folderId: string | null }) =>
      api.patch(`/api/dashboards/${id}`, { folder_id: folderId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-dashboards"] });
      qc.invalidateQueries({ queryKey: ["admin-folders"] });
      qc.invalidateQueries({ queryKey: ["dashboards"] });
    },
  });

  const GENERAL = "__general__";

  function onDropTo(groupKey: string) {
    setOverKey("");
    const id = dragId;
    setDragId(null);
    if (!id) return;
    const targetFolderId = groupKey === GENERAL ? null : groupKey;
    const d = data?.find((x) => x.id === id);
    if (!d || (d.folder_id ?? null) === targetFolderId) return; // already there
    move.mutate({ id, folderId: targetFolderId });
  }

  // Build drop groups: every folder (even empty) ordered by position, then General.
  const groups: { key: string; name: string; items: Dashboard[] }[] = [
    ...(folders ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((f) => ({
        key: f.id,
        name: f.name,
        items: (data ?? []).filter((d) => d.folder_id === f.id),
      })),
    { key: GENERAL, name: "General", items: (data ?? []).filter((d) => !d.folder_id) },
  ];

  if (isLoading) return <FullSpinner />;

  return (
    <div>
      <div className="mb-5 flex justify-end">
        <button className="btn-primary" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" /> Nuevo dashboard
        </button>
      </div>

      {data?.length === 0 ? (
        <div className="card p-10 text-center text-muted-fg">
          Aún no hay dashboards. Crea el primero.
        </div>
      ) : (
        <>
          <p className="mb-4 text-sm text-muted-fg">
            Arrastra un dashboard a otra carpeta para moverlo.
          </p>
          <div className="space-y-5">
            {groups.map((g) => {
              const isOver = overKey === g.key;
              return (
                <section
                  key={g.key}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (overKey !== g.key) setOverKey(g.key);
                  }}
                  onDrop={() => onDropTo(g.key)}
                  className={`rounded-2xl border-2 border-dashed p-3 transition ${
                    isOver ? "border-primary bg-primary-soft/50" : "border-transparent"
                  }`}
                >
                  <div className="mb-2 flex items-center gap-2 px-1">
                    <FolderOpen className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-fg">
                      {g.name}
                    </h3>
                    <span className="text-xs text-muted-fg">
                      {g.items.length} {g.items.length === 1 ? "dashboard" : "dashboards"}
                    </span>
                  </div>
                  {g.items.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-fg">
                      Arrastra dashboards aquí
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {g.items.map((d) => (
                        <div
                          key={d.id}
                          draggable
                          onDragStart={() => setDragId(d.id)}
                          onDragEnd={() => {
                            setDragId(null);
                            setOverKey("");
                          }}
                          className={`card flex flex-wrap items-center gap-3 p-4 transition ${
                            dragId === d.id ? "opacity-50 ring-2 ring-primary" : ""
                          }`}
                        >
                          <span
                            className="cursor-grab text-muted-fg active:cursor-grabbing"
                            title="Arrastrar para mover"
                          >
                            <GripVertical className="h-5 w-5" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-fg">{d.name}</span>
                              <TypeBadge type={d.type} />
                              <span className="badge bg-muted text-muted-fg">
                                {VISIBILITY_LABELS[d.visibility] ?? d.visibility}
                              </span>
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
                            onClick={() => setEditing(d)}
                            title="Editar / mover de carpeta"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          {d.type === "excel" && (
                            <button
                              className="btn-ghost p-2.5"
                              onClick={() => setChartFor(d)}
                              disabled={!d.has_content}
                              title="Configurar gráfico"
                            >
                              <BarChart3 className="h-4 w-4" />
                            </button>
                          )}
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
                  )}
                </section>
              );
            })}
          </div>
        </>
      )}

      <CreateModal
        open={showCreate}
        folders={folders ?? []}
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

      <ChartConfigModal
        dashboard={chartFor}
        onClose={() => setChartFor(null)}
        onSaved={() => qc.invalidateQueries({ queryKey: ["admin-dashboards"] })}
      />

      <EditModal
        dashboard={editing}
        folders={folders ?? []}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          qc.invalidateQueries({ queryKey: ["admin-dashboards"] });
          qc.invalidateQueries({ queryKey: ["dashboards"] });
        }}
      />
    </div>
  );
}

function EditModal({
  dashboard,
  folders,
  onClose,
  onSaved,
}: {
  dashboard: Dashboard | null;
  folders: Folder[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [folderId, setFolderId] = useState<string>("");
  const [visibility, setVisibility] = useState<Visibility>("restricted");
  const [error, setError] = useState("");

  // Seed the form whenever a new dashboard is opened.
  useEffect(() => {
    if (dashboard) {
      setName(dashboard.name);
      setDescription(dashboard.description || "");
      setFolderId(dashboard.folder_id || "");
      setVisibility(dashboard.visibility);
      setError("");
    }
  }, [dashboard]);

  const save = useMutation({
    mutationFn: async () =>
      api.patch(`/api/dashboards/${dashboard!.id}`, {
        name,
        description: description || null,
        visibility,
        folder_id: folderId || null,
      }),
    onSuccess: onSaved,
    onError: (err: any) => setError(err?.response?.data?.detail || "No se pudo guardar"),
  });

  return (
    <Modal open={!!dashboard} onClose={onClose} title={`Editar — ${dashboard?.name ?? ""}`}>
      <div className="space-y-4">
        <div>
          <label className="label">Nombre</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label">Descripción (opcional)</label>
          <textarea
            className="input min-h-[64px]"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Carpeta</label>
            <select
              className="input"
              value={folderId}
              onChange={(e) => setFolderId(e.target.value)}
            >
              <option value="">General (sin carpeta)</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted-fg">
              Crea y administra carpetas en la pestaña <strong>Carpetas</strong>.
            </p>
          </div>
          <div>
            <label className="label">Visibilidad</label>
            <select
              className="input"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as Visibility)}
            >
              {(Object.keys(VISIBILITY_LABELS) as Visibility[]).map((v) => (
                <option key={v} value={v}>
                  {VISIBILITY_LABELS[v]}
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
          <button
            className="btn-primary"
            onClick={() => save.mutate()}
            disabled={save.isPending || !name.trim()}
          >
            {save.isPending ? <Spinner className="border-primary-fg" /> : "Guardar"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

const CHART_TYPES: { value: ChartType; label: string }[] = [
  { value: "bar", label: "Barras" },
  { value: "line", label: "Líneas" },
  { value: "area", label: "Área" },
  { value: "pie", label: "Pastel" },
  { value: "none", label: "Sin gráfico" },
];

function ChartConfigModal({
  dashboard,
  onClose,
  onSaved,
}: {
  dashboard: Dashboard | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const id = dashboard?.id;
  const [sheet, setSheet] = useState("");
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [category, setCategory] = useState("");
  const [series, setSeries] = useState<string[]>([]);

  // Load the parsed Excel to populate sheet/column choices.
  const data = useQuery({
    queryKey: ["excel-admin", id],
    enabled: !!id,
    queryFn: async () => (await api.get<ExcelData>(`/api/dashboards/${id}/data`)).data,
  });

  // Seed form from the dashboard's existing config (or first sheet) once loaded.
  useEffect(() => {
    if (!dashboard || !data.data) return;
    const cfg = dashboard.excel_config;
    const first = data.data.sheets[0];
    if (cfg) {
      setSheet(cfg.sheet);
      setChartType(cfg.chart_type);
      setCategory(cfg.category);
      setSeries(cfg.series);
    } else if (first) {
      setSheet(first.name);
      setChartType(first.chart?.type ?? "bar");
      setCategory(first.chart?.category ?? first.columns[0] ?? "");
      setSeries(first.chart?.series ?? []);
    }
  }, [dashboard, data.data]);

  const activeSheet = data.data?.sheets.find((s) => s.name === sheet);

  const save = useMutation({
    mutationFn: async () =>
      api.patch(`/api/dashboards/${id}`, {
        excel_config: { sheet, chart_type: chartType, category, series },
      }),
    onSuccess: () => {
      onSaved();
      onClose();
    },
  });

  function toggleSeries(col: string) {
    setSeries((prev) => (prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]));
  }

  return (
    <Modal open={!!dashboard} onClose={onClose} title={`Gráfico — ${dashboard?.name ?? ""}`}>
      {data.isLoading ? (
        <div className="py-8">
          <FullSpinner />
        </div>
      ) : !data.data ? (
        <p className="py-6 text-center text-muted-fg">No se pudo leer el Excel.</p>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Hoja</label>
              <select
                className="input"
                value={sheet}
                onChange={(e) => setSheet(e.target.value)}
              >
                {data.data.sheets.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Tipo de gráfico</label>
              <select
                className="input"
                value={chartType}
                onChange={(e) => setChartType(e.target.value as ChartType)}
              >
                {CHART_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {chartType !== "none" && (
            <>
              <div>
                <label className="label">Columna de categoría (eje X)</label>
                <select
                  className="input"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {(activeSheet?.columns ?? []).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Series (columnas a graficar)</label>
                <div className="flex flex-wrap gap-2">
                  {(activeSheet?.columns ?? [])
                    .filter((c) => c !== category)
                    .map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => toggleSeries(c)}
                        className={`badge px-3 py-1.5 ${
                          series.includes(c)
                            ? "bg-primary text-primary-fg"
                            : "bg-muted text-muted-fg"
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                </div>
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-outline" onClick={onClose}>
              Cancelar
            </button>
            <button
              className="btn-primary"
              onClick={() => save.mutate()}
              disabled={save.isPending || !sheet}
            >
              {save.isPending ? <Spinner className="border-primary-fg" /> : "Guardar"}
            </button>
          </div>
        </div>
      )}
    </Modal>
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
  folders,
  onClose,
  onCreated,
}: {
  open: boolean;
  folders: Folder[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [folderId, setFolderId] = useState<string>("");
  const [type, setType] = useState<DashboardType>("static_html");
  const [visibility, setVisibility] = useState<Visibility>("restricted");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post("/api/dashboards", {
        name,
        description: description || null,
        type,
        visibility,
        folder_id: folderId || null,
      });
      setName("");
      setDescription("");
      setFolderId("");
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
        <div>
          <label className="label">Carpeta</label>
          <select
            className="input"
            value={folderId}
            onChange={(e) => setFolderId(e.target.value)}
          >
            <option value="">General (sin carpeta)</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
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
