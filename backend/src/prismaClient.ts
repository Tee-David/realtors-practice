import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * CockroachDB-optimized Prisma client with connection pool tuning.
 *
 * Pool settings are controlled via the DATABASE_URL connection string params:
 *   ?connection_limit=20&pool_timeout=30&connect_timeout=10
 *
 * These can also be overridden via environment variables:
 *   - PRISMA_CONNECTION_LIMIT (default 20 for production, 5 for dev)
 *   - PRISMA_POOL_TIMEOUT    (seconds to wait for a connection, default 30)
 *
 * CockroachDB notes:
 *   - CockroachDB uses a connection pool on its side as well.
 *   - Keep connection_limit <= number of CRDB vCPUs * 4 for best throughput.
 *   - Idle connections are reused automatically by Prisma's built-in pool.
 */
const connectionLimit =
  parseInt(process.env.PRISMA_CONNECTION_LIMIT || "", 10) ||
  (process.env.NODE_ENV === "production" ? 20 : 5);

const poolTimeout =
  parseInt(process.env.PRISMA_POOL_TIMEOUT || "", 10) || 30;

// Append pool params to DATABASE_URL if not already present
function getDatasourceUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url) return undefined;

  try {
    const parsed = new URL(url);
    if (!parsed.searchParams.has("connection_limit")) {
      parsed.searchParams.set("connection_limit", String(connectionLimit));
    }
    if (!parsed.searchParams.has("pool_timeout")) {
      parsed.searchParams.set("pool_timeout", String(poolTimeout));
    }
    if (!parsed.searchParams.has("connect_timeout")) {
      parsed.searchParams.set("connect_timeout", "10");
    }
    return parsed.toString();
  } catch {
    // If URL parsing fails, return as-is
    return url;
  }
}

const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Query logging can be enabled via DEBUG_PRISMA=true env var
    log:
      process.env.NODE_ENV === "development"
        ? process.env.DEBUG_PRISMA
          ? ["query", "error", "warn"]
          : ["error", "warn"]
        : ["error"],
    datasourceUrl: getDatasourceUrl(),
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
