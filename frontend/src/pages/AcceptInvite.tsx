import { LayoutGrid } from "lucide-react";
import { FormEvent, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import type { Me } from "../api/types";
import { ErrorText, Spinner } from "../components/ui";
import { useAuth } from "../lib/auth";

export default function AcceptInvite() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const navigate = useNavigate();
  const { setUser } = useAuth();

  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) return setError("La contraseña debe tener al menos 8 caracteres");
    if (password !== confirm) return setError("Las contraseñas no coinciden");
    setLoading(true);
    try {
      const { data } = await api.post<Me>("/api/auth/invite/accept", {
        token,
        password,
        display_name: displayName || null,
      });
      setUser(data);
      navigate("/");
    } catch (err: any) {
      setError(err?.response?.data?.detail || "No se pudo activar la cuenta");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="card w-full max-w-md p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-fg shadow-soft">
            <LayoutGrid className="h-7 w-7" />
          </div>
          <h1 className="font-display text-2xl font-semibold text-fg">Activa tu cuenta</h1>
          <p className="mt-1 text-sm text-muted-fg">Define tu contraseña para empezar</p>
        </div>

        {!token ? (
          <p className="text-center text-sm text-danger">
            Falta el token de invitación en el enlace.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="label">Nombre (opcional)</label>
              <input
                className="input"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Tu nombre"
              />
            </div>
            <div>
              <label className="label">Contraseña</label>
              <input
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">Repetir contraseña</label>
              <input
                type="password"
                className="input"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>
            <ErrorText>{error}</ErrorText>
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? <Spinner className="border-primary-fg" /> : "Activar cuenta"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
