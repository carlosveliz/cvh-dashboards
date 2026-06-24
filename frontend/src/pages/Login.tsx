import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { AuthShell } from "../components/AuthShell";
import { ErrorText, Spinner } from "../components/ui";
import { useAuth } from "../lib/auth";

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err: any) {
      setError(err?.response?.data?.detail || "No se pudo iniciar sesión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Inicia sesión" subtitle="Accede para ver tus dashboards">
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="label text-white">Email</label>
          <input
            type="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@empresa.com"
            required
            autoFocus
          />
        </div>
        <div>
          <label className="label text-white">Contraseña</label>
          <input
            type="password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
        </div>
        <ErrorText>{error}</ErrorText>
        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? <Spinner className="border-primary-fg" /> : "Entrar"}
        </button>
        <Link
          to="/forgot-password"
          className="block text-center text-sm text-dark-muted-fg transition hover:text-accent"
        >
          ¿Olvidaste tu contraseña?
        </Link>
      </form>
    </AuthShell>
  );
}
