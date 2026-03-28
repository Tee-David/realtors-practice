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
    if (event === "SIGNED_OUT") {
      // Clear any cached auth state
      localStorage.removeItem("sb-auth-token");
      localStorage.removeItem("rp-remember-me");
      localStorage.removeItem("rp-no-persist");
      sessionStorage.removeItem("rp-session-only");
    }
  });

  // "Remember me" enforcement: if user logged in without "Remember me",
  // sessionStorage has "rp-session-only". When browser closes, sessionStorage
  // clears. On next visit, "rp-no-persist" flag in localStorage tells us
  // the user explicitly chose not to be remembered — sign them out.
  //
  // IMPORTANT: Only run this check after confirming a session actually exists.
  // Running signOut() eagerly at module import can race with the login flow.
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (!session) return; // No session — nothing to clean up

    const remembered = localStorage.getItem("rp-remember-me");
    const sessionActive = sessionStorage.getItem("rp-session-only");
    const noPersist = localStorage.getItem("rp-no-persist");

    if (noPersist && !remembered && !sessionActive) {
      // Browser was reopened after a "don't remember me" login — clear session
      localStorage.removeItem("rp-no-persist");
      supabase.auth.signOut();
    }
  });
}
