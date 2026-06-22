import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Mail, Plus, Trash2 } from "lucide-react";
import { FormEvent, useState } from "react";
import { api } from "../../api/client";
import type { InvitationResult, Role, User } from "../../api/types";
import { ErrorText, FullSpinner, Modal, Spinner } from "../../components/ui";
import { useAuth } from "../../lib/auth";

function fmtLogin(iso: string | null): string {
  if (!iso) return "Nunca";
  return new Date(iso).toLocaleString("es", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminUsers() {
  const qc = useQueryClient();
  const { user: me } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [showInvite, setShowInvite] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => (await api.get<User[]>("/api/users")).data,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-users"] });

  const update = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Partial<User> }) =>
      api.patch(`/api/users/${id}`, body),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/api/users/${id}`),
    onSuccess: invalidate,
  });

  if (isLoading) return <FullSpinner />;

  return (
    <div>
      <div className="mb-5 flex justify-end gap-2">
        <button className="btn-outline" onClick={() => setShowInvite(true)}>
          <Mail className="h-4 w-4" /> Invitar
        </button>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" /> Nuevo usuario
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-muted-fg">
            <tr>
              <th className="px-4 py-3 font-semibold">Usuario</th>
              <th className="px-4 py-3 font-semibold">Rol</th>
              <th className="px-4 py-3 font-semibold">Estado</th>
              <th className="px-4 py-3 font-semibold">Último acceso</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {data?.map((u) => (
              <tr key={u.id} className="border-t border-border">
                <td className="px-4 py-3">
                  <div className="font-medium text-fg">{u.display_name || "—"}</div>
                  <div className="text-muted-fg">{u.email}</div>
                </td>
                <td className="px-4 py-3">
                  <select
                    className="input py-1.5"
                    value={u.role}
                    disabled={u.id === me?.id}
                    onChange={(e) =>
                      update.mutate({ id: u.id, body: { role: e.target.value as Role } })
                    }
                  >
                    <option value="user">user</option>
                    <option value="admin">admin</option>
                  </select>
                </td>
                <td className="px-4 py-3">
                  <button
                    disabled={u.id === me?.id}
                    onClick={() =>
                      update.mutate({ id: u.id, body: { is_active: !u.is_active } })
                    }
                    className={`badge ${
                      u.is_active ? "bg-accent-soft text-accent" : "bg-muted text-muted-fg"
                    }`}
                  >
                    {u.is_active ? "Activo" : "Inactivo"}
                  </button>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-muted-fg">
                  {fmtLogin(u.last_login_at)}
                </td>
                <td className="px-4 py-3 text-right">
                  {u.id !== me?.id && (
                    <button
                      className="btn-ghost p-2 text-danger"
                      onClick={() => {
                        if (confirm(`¿Eliminar a ${u.email}?`)) remove.mutate(u.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <CreateUserModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onDone={() => {
          setShowCreate(false);
          invalidate();
        }}
      />
      <InviteModal open={showInvite} onClose={() => setShowInvite(false)} />
    </div>
  );
}

function CreateUserModal({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("user");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post("/api/users", {
        email,
        password,
        role,
        display_name: displayName || null,
      });
      setEmail("");
      setDisplayName("");
      setPassword("");
      setRole("user");
      onDone();
    } catch (err: any) {
      setError(err?.response?.data?.detail || "No se pudo crear");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nuevo usuario">
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="label">Email</label>
          <input
            type="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label">Nombre (opcional)</label>
          <input
            className="input"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Contraseña</label>
            <input
              type="text"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
          </div>
          <div>
            <label className="label">Rol</label>
            <select className="input" value={role} onChange={(e) => setRole(e.target.value as Role)}>
              <option value="user">user</option>
              <option value="admin">admin</option>
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

function InviteModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("user");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<InvitationResult | null>(null);
  const [copied, setCopied] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post<InvitationResult>("/api/users/invite", { email, role });
      setResult(data);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "No se pudo invitar");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setEmail("");
    setRole("user");
    setResult(null);
    setError("");
    setCopied(false);
    onClose();
  }

  return (
    <Modal open={open} onClose={reset} title="Invitar usuario">
      {result ? (
        <div className="space-y-4">
          <p className="text-sm text-fg">
            {result.emailed
              ? `Invitación enviada por correo a ${result.email}.`
              : `SMTP no configurado. Comparte este enlace con ${result.email}:`}
          </p>
          <div className="flex items-center gap-2">
            <input className="input" value={result.invite_url} readOnly />
            <button
              className="btn-outline shrink-0"
              onClick={() => {
                navigator.clipboard.writeText(result.invite_url);
                setCopied(true);
              }}
            >
              <Copy className="h-4 w-4" /> {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
          <div className="flex justify-end">
            <button className="btn-primary" onClick={reset}>
              Listo
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">Rol</label>
            <select className="input" value={role} onChange={(e) => setRole(e.target.value as Role)}>
              <option value="user">user</option>
              <option value="admin">admin</option>
            </select>
          </div>
          <ErrorText>{error}</ErrorText>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-outline" onClick={reset}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? <Spinner className="border-primary-fg" /> : "Generar invitación"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
