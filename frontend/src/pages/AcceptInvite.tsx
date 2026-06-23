import { FormEvent, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import type { Me } from "../api/types";
import { AuthShell } from "../components/AuthShell";
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
    <AuthShell title="Activa tu cuenta" subtitle="Define tu contraseña para empezar">
      {!token ? (
        <p className="text-center text-sm text-danger">
          Falta el token de invitación en el enlace.
        </p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="label text-white">Nombre (opcional)</label>
            <input
              className="input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Tu nombre"
            />
          </div>
          <div>
            <label className="label text-white">Contraseña</label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label text-white">Repetir contraseña</label>
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
    </AuthShell>
  );
}
