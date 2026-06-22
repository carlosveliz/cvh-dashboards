import { LayoutGrid } from "lucide-react";
import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
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
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="card w-full max-w-md p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-fg shadow-soft">
            <LayoutGrid className="h-7 w-7" />
          </div>
          <h1 className="font-display text-2xl font-semibold text-fg">¿Olvidaste tu contraseña?</h1>
          <p className="mt-1 text-sm text-muted-fg">
            Te enviaremos un enlace para crear una nueva.
          </p>
        </div>

        {sent ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-fg">
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
            <ErrorText>{error}</ErrorText>
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? <Spinner className="border-primary-fg" /> : "Enviar enlace"}
            </button>
            <Link to="/login" className="block text-center text-sm text-muted-fg hover:text-fg">
              Volver a iniciar sesión
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
