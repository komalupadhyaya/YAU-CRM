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

// Global online/offline browser listeners to manage network status toast cleanly
if (typeof window !== "undefined") {
  window.addEventListener("offline", () => {
    toast.error("Network connection lost. You are currently offline.", {
      id: "network-error-toast",
      duration: 5000,
    });
  });

  window.addEventListener("online", () => {
    toast.success("Internet connection restored!", {
      id: "network-error-toast",
      duration: 3000,
    });
  });
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    let message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      (typeof error.response?.data === "string" ? error.response.data : null) ||
      error.message ||
      "An unexpected error occurred";

    if (typeof message === "string" && message.includes("already completed this form")) {
      message = "This number or the email is already present";
    }

    // Handle 401 Unauthorized — cookie is invalid or expired
    if (status === 401) {
      if (!window.location.pathname.includes("/login")) {
        window.location.href = "/login";
        return Promise.reject(error);
      }
    }

    // Detect network / offline disconnection error
    const isNetworkError =
      !error.response ||
      error.code === "ERR_NETWORK" ||
      error.code === "ECONNABORTED" ||
      (typeof error.message === "string" && error.message.toLowerCase().includes("network error"));

    if (isNetworkError) {
      // Use fixed toast ID so multiple simultaneous requests only trigger 1 single toast banner
      toast.error("Network connection error. Please check your internet connection.", {
        id: "network-error-toast",
        duration: 4000,
      });
      return Promise.reject(error);
    }

    // Show error toast for all other non-401 errors
    if (status !== 401) {
      toast.error(message);
    }

    return Promise.reject(error);
  }
);

export default api;