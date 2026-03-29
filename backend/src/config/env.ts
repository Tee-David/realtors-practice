import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

export const config = {
  env: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT || "5000", 10),
  databaseUrl: process.env.DATABASE_URL,
  betterAuth: {
    secret: process.env.BETTER_AUTH_SECRET || "",
    url: process.env.BETTER_AUTH_URL || "http://localhost:5000",
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
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
    internalKey: (() => {
      const key = process.env.INTERNAL_API_KEY;
      if (!key || key === "dev-internal-key") {
        if (process.env.NODE_ENV === "production") {
          throw new Error("INTERNAL_API_KEY must be set in production (cannot use default)");
        }
        return key || "dev-internal-key";
      }
      return key;
    })(),
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
  github: {
    pat: process.env.GITHUB_PAT || "",
    repo: process.env.GITHUB_REPO || "Tee-David/realtors-practice",
  },
  ai: {
    groqApiKey: process.env.GROQ_API_KEY || "",
    cerebrasApiKey: process.env.CEREBRAS_API_KEY || "",
    sambanovaApiKey: process.env.SAMBANOVA_API_KEY || "",
    geminiApiKey: process.env.GEMINI_API_KEY || "",
  },
};

