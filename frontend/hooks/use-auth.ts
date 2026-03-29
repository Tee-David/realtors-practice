"use client";

import { useSession } from "@/lib/auth-client";

export function useAuth() {
  const { data: session, isPending: loading } = useSession();

  return {
    session,
    loading,
    isAuthenticated: !!session?.user,
    user: session?.user ?? null,
  };
}
