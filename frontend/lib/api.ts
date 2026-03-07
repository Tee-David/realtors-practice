import axios from "axios";
import { supabase } from "./supabase";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});

// Attach auth token to every request
api.interceptors.request.use(async (config) => {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

// Handle 401 responses
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const { error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        await supabase.auth.signOut();
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

// API method namespaces
export const auth = {
  me: () => api.get("/auth/me"),
  register: (data: { email: string; password: string; firstName?: string; lastName?: string; role?: string }) =>
    api.post("/auth/register", data),
};

export const health = {
  check: () => api.get("/health"),
};

export const analytics = {
  overview: () => api.get("/analytics/overview"),
  trends: () => api.get("/analytics/trends"),
};

export const properties = {
  list: (params?: Record<string, unknown>) => api.get("/properties", { params }),
  get: (id: string) => api.get(`/properties/${id}`),
  update: (id: string, data: Record<string, unknown>) => api.put(`/properties/${id}`, data),
};

export default api;
