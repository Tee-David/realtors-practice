import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// Clean up stale sessions on auth state changes
if (typeof window !== "undefined") {
  supabase.auth.onAuthStateChange((event) => {
    if (event === "TOKEN_REFRESHED") {
      // Session refreshed successfully — no action needed
    } else if (event === "SIGNED_OUT") {
      // Clear any cached auth state
      localStorage.removeItem("sb-auth-token");
    }
  });
}
