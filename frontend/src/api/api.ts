import axios from "axios";
import { toast } from "sonner";

const API_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD
    ? "https://yau-crm-production.up.railway.app/api"
    : "http://localhost:5000/api");

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
    const message =
      error.response?.data?.error ||
      error.message ||
      "An unexpected error occurred";

    if (
      error.response?.status !== 401 ||
      !window.location.pathname.includes("/login")
    ) {
      toast.error(message);
    }

    return Promise.reject(error);
  }
);

export default api;