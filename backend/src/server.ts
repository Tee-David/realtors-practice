import http from "http";
import app from "./app";
import { config } from "./config/env";
import prisma from "./prismaClient";
import { createSocketServer } from "./socketServer";
import { Logger } from "./utils/logger.util";

const PORT = config.port;

async function startServer() {
  // Startup validation for critical env vars
  if (!config.scraper.internalKey || config.scraper.internalKey === "dev-internal-key") {
    if (config.env === "production") {
      Logger.error("FATAL: INTERNAL_API_KEY is not set or using default value in production. Scraper callbacks will fail.");
      process.exit(1);
    } else {
      Logger.warn("INTERNAL_API_KEY is not set — using dev default. Scraper callbacks won't work in production.");
    }
  }

  if (!process.env.DATABASE_URL) {
    Logger.warn("DATABASE_URL is missing — database connection will fail.");
  }

  try {
    let connected = false;
    let retries = 3;

    while (!connected && retries > 0) {
      try {
        await prisma.$connect();
        Logger.info("Database connected successfully");
        connected = true;
      } catch (error) {
        retries--;
        Logger.error(
          `Database connection failed. Retries left: ${retries}`,
          error
        );
        if (retries === 0) {
          throw new Error(
            "Failed to connect to database after multiple attempts"
          );
        }
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }

    // Create HTTP server and attach Socket.io
    const httpServer = http.createServer(app);
    createSocketServer(httpServer);

    httpServer.listen(PORT, () => {
      Logger.info(`Server is running on port ${PORT}`);
      Logger.info(`Environment: ${config.env}`);
      Logger.info(`Health check: http://localhost:${PORT}/health`);
      Logger.info(`Socket.io: ws://localhost:${PORT}/ws`);
      
      // Initialize Cron Jobs
      const { CronService } = require("./services/cron.service");
      CronService.init();

      // Configure Meilisearch index on startup (idempotent)
      const { MeiliService } = require("./services/meili.service");
      MeiliService.configureIndex().catch((err: any) =>
        Logger.warn(`Meilisearch index config skipped: ${err.message}`)
      );
    });
  } catch (error) {
    Logger.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on("SIGINT", async () => {
  Logger.info("SIGINT received: shutting down");
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  Logger.info("SIGTERM received: shutting down");
  await prisma.$disconnect();
  process.exit(0);
});

startServer();

