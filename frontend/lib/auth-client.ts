import { createAuthClient } from "better-auth/react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
// Better Auth base URL is the backend root (not /api)
const baseURL = API_URL.replace(/\/api\/?$/, "");

export const authClient = createAuthClient({
  baseURL,
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  getSession,
} = authClient;
