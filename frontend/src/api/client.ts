import axios from "axios";

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? decodeURIComponent(match[2]) : null;
}

export const api = axios.create({
  baseURL: "/",
  withCredentials: true,
});

// Double-submit CSRF: attach the readable csrf_token cookie on mutations.
api.interceptors.request.use((config) => {
  const method = (config.method || "get").toUpperCase();
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    const csrf = getCookie("csrf_token");
    if (csrf) {
      config.headers = config.headers ?? {};
      config.headers["X-CSRF-Token"] = csrf;
    }
  }
  return config;
});
