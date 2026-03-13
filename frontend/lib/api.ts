import axios from "axios";
import { supabase } from "./supabase";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
});

// Cache the session token to avoid blocking getSession() on every request
let cachedToken: string | null = null;
let tokenExpiry = 0;

if (typeof window !== "undefined") {
  supabase.auth.onAuthStateChange((_event, session) => {
    cachedToken = session?.access_token || null;
    tokenExpiry = session?.expires_at ? session.expires_at * 1000 : 0;
  });
  // Initialize from current session
  supabase.auth.getSession().then(({ data: { session } }) => {
    cachedToken = session?.access_token || null;
    tokenExpiry = session?.expires_at ? session.expires_at * 1000 : 0;
  });
}

// Attach auth token to every request
api.interceptors.request.use(async (config) => {
  // Use cached token if still valid (with 60s buffer)
  if (cachedToken && tokenExpiry > Date.now() + 60000) {
    config.headers.Authorization = `Bearer ${cachedToken}`;
    return config;
  }
  // Fallback: refresh from Supabase
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    cachedToken = session.access_token;
    tokenExpiry = session.expires_at ? session.expires_at * 1000 : 0;
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

// Handle 401 responses — retry once after refreshing session
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const { data, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !data.session) {
        await supabase.auth.signOut();
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
        return Promise.reject(error);
      }
      // Retry with the new token
      originalRequest.headers.Authorization = `Bearer ${data.session.access_token}`;
      return api(originalRequest);
    }
    return Promise.reject(error);
  }
);

// API method namespaces
export const auth = {
  me: () => api.get("/auth/me"),
  updateProfile: (data: { firstName?: string; lastName?: string; phone?: string; bio?: string; company?: string; avatarUrl?: string | null }) =>
    api.patch("/auth/me", data),
  register: (data: { email: string; password: string; firstName?: string; lastName?: string; role?: string }) =>
    api.post("/auth/register", data),
  invite: (data: { email: string; firstName?: string; lastName?: string; role?: string }) =>
    api.post("/auth/invite", data),
  testEmail: (to?: string) => api.post("/auth/test-email", { to }),
  validateInvite: (code: string) =>
    api.post("/auth/validate-invite", { code }),
  registerWithCode: (data: { code: string; email: string; password: string; firstName?: string; lastName?: string }) =>
    api.post("/auth/register-with-code", data),
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

export const savedSearches = {
  list: () => api.get("/saved-searches"),
  get: (id: string) => api.get(`/saved-searches/${id}`),
  create: (data: Record<string, unknown>) => api.post("/saved-searches", data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/saved-searches/${id}`, data),
  delete: (id: string) => api.delete(`/saved-searches/${id}`),
  getMatches: (id: string, params?: Record<string, unknown>) => api.get(`/saved-searches/${id}/matches`, { params }),
  markMatchesSeen: (id: string) => api.patch(`/saved-searches/${id}/matches/seen`),
};

export const notifications = {
  list: (params?: Record<string, unknown>) => api.get("/notifications", { params }),
  unreadCount: () => api.get("/notifications/unread-count"),
  markRead: (id: string) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch("/notifications/read-all"),
};

export const users = {
  list: () => api.get("/users"),
  updateRole: (id: string, role: string) => api.patch(`/users/${id}/role`, { role }),
  toggleActive: (id: string) => api.patch(`/users/${id}/toggle-active`),
  updateProfile: (data: Record<string, unknown>) => api.patch("/users/me", data),
};

export const auditLogs = {
  list: (params?: Record<string, unknown>) => api.get("/audit-logs", { params }),
  get: (id: string) => api.get(`/audit-logs/${id}`),
};

export const exports = {
  csv: (propertyIds?: string[]) => api.post("/export/csv", { propertyIds }, { responseType: "blob" }),
  csvFiltered: (filters: Record<string, unknown>) => api.post("/export/csv/filtered", filters, { responseType: "blob" }),
};

export default api;
