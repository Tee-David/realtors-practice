import axios from "axios";
import { supabase } from "./supabase";

let API_URL = "http://localhost:5000/api";
if (typeof process !== "undefined" && process.env && process.env.NEXT_PUBLIC_API_URL) {
  API_URL = process.env.NEXT_PUBLIC_API_URL;
}

const api = axios.create({
  baseURL: API_URL,
  timeout: 3000,
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
  create: (data: Record<string, unknown>) => api.post("/properties", data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/properties/${id}`, data),
  delete: (id: string) => api.delete(`/properties/${id}`),
  versions: (id: string, params?: Record<string, unknown>) => api.get(`/properties/${id}/versions`, { params }),
  priceHistory: (id: string) => api.get(`/properties/${id}/price-history`),
  enrich: (id: string, data: Record<string, unknown>) => api.patch(`/properties/${id}/enrich`, data),
  bulkAction: (data: { ids: string[]; action: string }) => api.post("/properties/bulk-action", data),
  stats: () => api.get("/properties/stats"),
};

export const sites = {
  list: (params?: Record<string, unknown>) => api.get("/sites", { params }),
  get: (id: string) => api.get(`/sites/${id}`),
  create: (data: Record<string, unknown>) => api.post("/sites", data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/sites/${id}`, data),
  toggle: (id: string) => api.patch(`/sites/${id}/toggle`),
  delete: (id: string) => api.delete(`/sites/${id}`),
};

export const search = {
  search: (params?: Record<string, unknown>) => api.get("/search", { params }),
  suggestions: (params?: Record<string, unknown>) => api.get("/search/suggestions", { params }),
};

export default api;
