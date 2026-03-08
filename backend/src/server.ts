import http from "http";
import app from "./app";
import { config } from "./config/env";
import prisma from "./prismaClient";
import { createSocketServer } from "./socketServer";
import { Logger } from "./utils/logger.util";

const PORT = config.port;

async function startServer() {
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

