import axios from "axios";
import { toast } from "sonner";

const API_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD
    ? "https://api.yauapp.com/api"
    : "http://localhost:5000/api");

const api = axios.create({
  baseURL: API_URL,
  // ── Cookie-based auth ──────────────────────────────────────────────────────
  // This tells the browser to automatically include the httpOnly cookie
  // (yau_crm_token) in every request to the backend. No localStorage needed.
  withCredentials: true,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const message =
      error.response?.data?.error ||
      error.message ||
      "An unexpected error occurred";

    // Handle 401 Unauthorized — cookie is invalid or expired
    if (status === 401) {
      if (!window.location.pathname.includes("/login")) {
        window.location.href = "/login";
        return Promise.reject(error);
      }
    }

    // Show error toast for all non-401 errors
    if (status !== 401) {
      toast.error(message);
    }

    return Promise.reject(error);
  }
);

export default api;