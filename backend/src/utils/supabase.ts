import { createClient } from "@supabase/supabase-js";
import { config } from "../config/env";

export const supabaseAdmin = createClient(
  config.supabase.url,
  config.supabase.serviceRoleKey || config.supabase.anonKey,
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
