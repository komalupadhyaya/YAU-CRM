import axios from "axios";
import { toast } from "sonner";

const API_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD
    ? "https://api.yauapp.com/api"
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
    const status = error.response?.status;
    const message =
      error.response?.data?.error ||
      error.message ||
      "An unexpected error occurred";

    // Handle 401 Unauthorized
    if (status === 401) {
      // Clear token and redirect to login if not already there
      localStorage.removeItem("token");
      if (!window.location.pathname.includes("/login")) {
        window.location.href = "/login";
        return Promise.reject(error); // Stop here
      }
    }

    // Only show toast if not a 401 or if it's an explicit error
    if (status !== 401) {
      toast.error(message);
    }

    return Promise.reject(error);
  }
);

export default api;