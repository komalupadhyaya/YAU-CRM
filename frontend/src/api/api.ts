import axios from "axios";
import { toast } from "sonner";

// let API_URL = import.meta.env.VITE_API_URL || "https://yau-crm-production.up.railway.app";

let API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

// Ensure URL ends with /api for consistency with backend routes
if (!API_URL.endsWith("/api") && !API_URL.endsWith("/api/")) {
  API_URL = API_URL.replace(/\/$/, "") + "/api";
}

const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = "Bearer " + token;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.error || error.message || "An unexpected error occurred";
    // Avoid showing toast for 401 on login page or if already handled locally if needed, 
    // but globally showing errors is a good UX for this internal tool.
    if (error.response?.status !== 401 || !window.location.pathname.includes('/login')) {
      toast.error(message);
    }
    return Promise.reject(error);
  }
);

export default api;
