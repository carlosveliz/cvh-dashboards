import { LayoutGrid } from "lucide-react";
import { FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary-soft blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-accent-soft blur-3xl" />

      <div className="card relative w-full max-w-md p-8">
        <div className="mb-7 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-fg shadow-soft">
            <LayoutGrid className="h-7 w-7" />
          </div>
          <h1 className="font-display text-2xl font-semibold text-fg">
            CVH Dashboards
          </h1>
          <p className="mt-1 text-sm text-muted-fg">
            Inicia sesión para ver tus dashboards
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="label">Email</label>
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
            <label className="label">Contraseña</label>
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
        </form>
      </div>
    </div>
  );
}
