import { Server as HttpServer } from "http";
import { Server, Namespace } from "socket.io";
import { config } from "./config/env";
import { auth } from "./lib/auth";
import { fromNodeHeaders } from "better-auth/node";
import prisma from "./prismaClient";
import { Logger } from "./utils/logger.util";

let io: Server;
let scrapeNamespace: Namespace;
let notifyNamespace: Namespace;

export function createSocketServer(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    path: "/ws",
    cors: {
      origin: [
              "http://localhost:3000",
              "http://localhost:5173",
              "http://127.0.0.1:3000",
              config.cors.origin,
            ],
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  // --- Auth middleware (Better Auth session cookie) ---
  const authMiddleware = async (socket: any, next: any) => {
    try {
      // Better Auth uses httpOnly cookies — extract from handshake headers
      const headers = socket.handshake.headers;
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(headers as any),
      });

      if (!session?.user) {
        return next(new Error("Authentication required"));
      }

      // Look up our internal user by email
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true, email: true },
      });

      if (!user) {
        return next(new Error("User not found"));
      }

      socket.data.userId = user.id;
      socket.data.email = user.email;
      next();
    } catch {
      next(new Error("Authentication failed"));
    }
  };

  // --- Scrape namespace (/scrape) ---
  scrapeNamespace = io.of("/scrape");
  scrapeNamespace.use(authMiddleware);
  scrapeNamespace.on("connection", (socket) => {
    Logger.info(`[Socket.io /scrape] User connected: ${socket.data.email}`);

    socket.on("join:job", (jobId: string) => {
      socket.join(`job:${jobId}`);
      Logger.info(
        `[Socket.io /scrape] ${socket.data.email} joined job:${jobId}`
      );
    });

    socket.on("leave:job", (jobId: string) => {
      socket.leave(`job:${jobId}`);
    });

    socket.on("disconnect", () => {
      Logger.info(
        `[Socket.io /scrape] User disconnected: ${socket.data.email}`
      );
    });
  });

  // --- Notify namespace (/notify) ---
  notifyNamespace = io.of("/notify");
  notifyNamespace.use(authMiddleware);
  notifyNamespace.on("connection", (socket) => {
    // Join user-specific room for targeted notifications
    socket.join(`user:${socket.data.userId}`);
    Logger.info(`[Socket.io /notify] User connected: ${socket.data.email}`);

    socket.on("disconnect", () => {
      Logger.info(
        `[Socket.io /notify] User disconnected: ${socket.data.email}`
      );
    });
  });

  Logger.info("Socket.io server initialized with /scrape and /notify namespaces");
  return io;
}

// --- Broadcast helpers ---

export function broadcastScrapeLog(
  jobId: string,
  level: string,
  message: string,
  details?: Record<string, unknown>
): void {
  if (!scrapeNamespace) return;
  const payload = {
    jobId,
    level,
    message,
    details,
    timestamp: new Date().toISOString(),
  };
  // Emit to job-specific room
  scrapeNamespace.to(`job:${jobId}`).emit("job:log", payload);
  // Also emit namespace-wide for the live log feed
  scrapeNamespace.emit("scrape_log", payload);
}

export function broadcastScrapeProgress(
  jobId: string,
  data: {
    processed: number;
    total: number;
    currentSite?: string;
    message?: string;
    currentPage?: number;
    maxPages?: number;
    pagesFetched?: number;
    propertiesFound?: number;
    duplicates?: number;
    errors?: number;
  }
): void {
  if (!scrapeNamespace) return;
  const payload = { jobId, ...data, timestamp: new Date().toISOString() };
  // Emit to job room (targeted) AND namespace-wide (fallback)
  scrapeNamespace.to(`job:${jobId}`).emit("job:progress", payload);
  scrapeNamespace.emit("job:progress", payload);
}

export function broadcastScrapeProperty(
  jobId: string,
  property: Record<string, unknown>
): void {
  if (!scrapeNamespace) return;
  const payload = { jobId, property, timestamp: new Date().toISOString() };
  scrapeNamespace.to(`job:${jobId}`).emit("job:property", payload);
  scrapeNamespace.emit("job:property", payload);
}

export function broadcastScrapeComplete(
  jobId: string,
  stats: Record<string, unknown>
): void {
  if (!scrapeNamespace) return;
  const payload = { jobId, stats, timestamp: new Date().toISOString() };
  scrapeNamespace.to(`job:${jobId}`).emit("job:completed", payload);
  scrapeNamespace.emit("job:completed", payload);
  // Notify all clients to refresh job list
  scrapeNamespace.emit("job_update", { jobId, status: "COMPLETED" });
}

export function broadcastScrapeError(jobId: string, error: string): void {
  if (!scrapeNamespace) return;
  const payload = { jobId, error, timestamp: new Date().toISOString() };
  scrapeNamespace.to(`job:${jobId}`).emit("job:error", payload);
  scrapeNamespace.emit("job:error", payload);
  // Notify all clients to refresh job list
  scrapeNamespace.emit("job_update", { jobId, status: "FAILED" });
}

export function broadcastNotification(
  userId: string,
  notification: Record<string, unknown>
): void {
  if (!notifyNamespace) return;
  notifyNamespace.to(`user:${userId}`).emit("notification:new", notification);
}

export { io };
