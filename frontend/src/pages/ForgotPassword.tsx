import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { AuthShell } from "../components/AuthShell";
import { ErrorText, Spinner } from "../components/ui";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post("/api/auth/forgot", { email });
      setSent(true);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "No se pudo procesar la solicitud");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="¿Olvidaste tu contraseña?"
      subtitle="Te enviaremos un enlace para crear una nueva."
    >
      {sent ? (
        <div className="space-y-4 text-center">
          <p className="text-sm font-light text-white">
            Si existe una cuenta con ese correo, recibirás un enlace para restablecer tu
            contraseña.
          </p>
          <Link to="/login" className="btn-outline w-full">
            Volver a iniciar sesión
          </Link>
        </div>
      ) : (
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
          <ErrorText>{error}</ErrorText>
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? <Spinner className="border-primary-fg" /> : "Enviar enlace"}
          </button>
          <Link
            to="/login"
            className="block text-center text-sm text-dark-muted-fg transition hover:text-accent"
          >
            Volver a iniciar sesión
          </Link>
        </form>
      )}
    </AuthShell>
  );
}
