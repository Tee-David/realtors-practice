import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

if (!process.env.SUPABASE_URL) {
  throw new Error("SUPABASE_URL environment variable is required");
}

if (!process.env.SUPABASE_ANON_KEY) {
  throw new Error("SUPABASE_ANON_KEY environment variable is required");
}

export const config = {
  env: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT || "5000", 10),
  databaseUrl: process.env.DATABASE_URL,
  supabase: {
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  },
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  },
  meilisearch: {
    url: process.env.MEILISEARCH_URL || "http://localhost:7700",
    masterKey: process.env.MEILISEARCH_MASTER_KEY || "",
  },
  scraper: {
    url: process.env.SCRAPER_URL || "http://localhost:8000",
    internalKey: process.env.INTERNAL_API_KEY || "dev-internal-key",
    jobTimeoutMs: parseInt(
      process.env.SCRAPE_JOB_TIMEOUT_MS || String(30 * 60 * 1000),
      10
    ),
  },
  resend: {
    apiKey: process.env.RESEND_API_KEY || "",
  },
  redis: {
    url: process.env.REDIS_URL || "",
  },
  callbackRetry: {
    maxAttempts: parseInt(process.env.CALLBACK_RETRY_MAX_ATTEMPTS || "5", 10),
    baseDelayMs: parseInt(process.env.CALLBACK_RETRY_BASE_DELAY_MS || "1000", 10),
  },
  exchangeRate: {
    apiKey: process.env.EXCHANGERATE_API_KEY || "",
  },
};

