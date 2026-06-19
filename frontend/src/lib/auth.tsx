import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api } from "../api/client";
import type { Me } from "../api/types";

interface AuthState {
  user: Me | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: Me | null) => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    try {
      const { data } = await api.get<Me>("/api/auth/me");
      setUser(data);
    } catch {
      // Try a refresh once before giving up.
      try {
        const { data } = await api.post<Me>("/api/auth/refresh");
        setUser(data);
      } catch {
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await api.post<Me>("/api/auth/login", { email, password });
    setUser(data);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/api/auth/logout");
    } finally {
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
