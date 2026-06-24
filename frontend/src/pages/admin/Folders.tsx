import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronUp,
  FolderOpen,
  FolderPlus,
  Pencil,
  Trash2,
} from "lucide-react";
import { FormEvent, useState } from "react";
import { api } from "../../api/client";
import type { Folder } from "../../api/types";
import { ErrorText, FullSpinner, Modal, Spinner } from "../../components/ui";

export default function AdminFolders() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [renaming, setRenaming] = useState<Folder | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-folders"],
    queryFn: async () => (await api.get<Folder[]>("/api/folders")).data,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-folders"] });
    qc.invalidateQueries({ queryKey: ["admin-dashboards"] });
    qc.invalidateQueries({ queryKey: ["dashboards"] });
  };

  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/api/folders/${id}`),
    onSuccess: invalidate,
  });

  const reorder = useMutation({
    mutationFn: async (ids: string[]) => api.put("/api/folders/reorder", { ids }),
    onSuccess: invalidate,
  });

  function move(index: number, dir: -1 | 1) {
    if (!data) return;
    const ids = data.map((f) => f.id);
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    reorder.mutate(ids);
  }

  if (isLoading) return <FullSpinner />;

  const folders = data ?? [];

  return (
    <div>
      <div className="mb-5 flex justify-end">
        <button className="btn-primary" onClick={() => setShowCreate(true)}>
          <FolderPlus className="h-4 w-4" /> Nueva carpeta
        </button>
      </div>

      {folders.length === 0 ? (
        <div className="card p-10 text-center text-muted-fg">
          Aún no hay carpetas. Crea la primera para organizar tus dashboards.
        </div>
      ) : (
        <div className="card divide-y divide-border overflow-hidden">
          {folders.map((f, i) => (
            <div key={f.id} className="flex items-center gap-3 px-4 py-3.5">
              <div className="flex flex-col">
                <button
                  className="btn-ghost p-0.5 disabled:opacity-30"
                  disabled={i === 0 || reorder.isPending}
                  onClick={() => move(i, -1)}
                  title="Subir"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button
                  className="btn-ghost p-0.5 disabled:opacity-30"
                  disabled={i === folders.length - 1 || reorder.isPending}
                  onClick={() => move(i, 1)}
                  title="Bajar"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <FolderOpen className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-fg">{f.name}</div>
                <div className="text-sm text-muted-fg">
                  {f.dashboard_count} {f.dashboard_count === 1 ? "dashboard" : "dashboards"}
                </div>
              </div>
              <button className="btn-ghost p-2.5" onClick={() => setRenaming(f)} title="Renombrar">
                <Pencil className="h-4 w-4" />
              </button>
              <button
                className="btn-ghost p-2.5 text-danger"
                onClick={() => {
                  if (
                    confirm(
                      `¿Eliminar la carpeta "${f.name}"? Sus ${f.dashboard_count} dashboard(s) pasarán a "General".`,
                    )
                  )
                    remove.mutate(f.id);
                }}
                title="Eliminar"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="mt-4 text-sm text-muted-fg">
        Los dashboards sin carpeta aparecen en <strong>General</strong>. Para mover un dashboard,
        edítalo en la pestaña <strong>Dashboards</strong>.
      </p>

      <FolderModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onDone={() => {
          setShowCreate(false);
          invalidate();
        }}
      />
      <FolderModal
        folder={renaming}
        open={!!renaming}
        onClose={() => setRenaming(null)}
        onDone={() => {
          setRenaming(null);
          invalidate();
        }}
      />
    </div>
  );
}

function FolderModal({
  folder,
  open,
  onClose,
  onDone,
}: {
  folder?: Folder | null;
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Seed name when (re)opening for a rename.
  const seeded = folder?.id ?? "new";
  const [seedKey, setSeedKey] = useState("");
  if (open && seedKey !== seeded) {
    setSeedKey(seeded);
    setName(folder?.name ?? "");
    setError("");
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (folder) await api.patch(`/api/folders/${folder.id}`, { name });
      else await api.post("/api/folders", { name });
      onDone();
    } catch (err: any) {
      setError(err?.response?.data?.detail || "No se pudo guardar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={folder ? "Renombrar carpeta" : "Nueva carpeta"}>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="label">Nombre</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Finanzas, Operaciones…"
            required
            autoFocus
          />
        </div>
        <ErrorText>{error}</ErrorText>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-outline" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn-primary" disabled={loading || !name.trim()}>
            {loading ? <Spinner className="border-primary-fg" /> : folder ? "Guardar" : "Crear"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
