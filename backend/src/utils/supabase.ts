import { createClient } from "@supabase/supabase-js";
import { config } from "../config/env";

if (!config.supabase.serviceRoleKey) {
  throw new Error(
    "SUPABASE_SERVICE_ROLE_KEY is not set. The admin client requires the service role key."
  );
}

export const supabaseAdmin = createClient(
  config.supabase.url,
  config.supabase.serviceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export const supabaseClient = createClient(
  config.supabase.url,
  config.supabase.anonKey
);
