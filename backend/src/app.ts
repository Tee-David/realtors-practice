import express, { type Application } from "express";
import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";

// Initialize Sentry early
Sentry.init({
  dsn: process.env.SENTRY_DSN || "",
  integrations: [
    nodeProfilingIntegration(),
  ],
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,
  profilesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,
});

import compression from "compression";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { config } from "./config/env";
import { setupSwagger } from "./config/swagger";
import routes from "./routes/index";
import { errorHandler, notFoundHandler } from "./middlewares/error.middleware";
import { csrfProtection } from "./middlewares/csrf.middleware";
import {
  extractUserIdForRateLimit,
  perUserRateLimiter,
} from "./middlewares/perUserRateLimit.middleware";

const app: Application = express();

// Initialize Swagger documentation
setupSwagger(app);

// Security headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'none'"],
        styleSrc: ["'none'"],
        imgSrc: ["'none'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
      },
    },
    // X-Content-Type-Options: nosniff is enabled by default in helmet
  })
);

// CORS
app.use(
  cors({
    origin: (origin, callback) => {
      const allowedOrigins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        config.cors.origin,
      ];

      if (config.env !== "production") {
        return callback(null, true);
      }

      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"), false);
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Internal-Key"],
  })
);

import mongoSanitize from "express-mongo-sanitize";

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.env === "production" ? 300 : 2000, // Tightened from 500 to 300
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === "/health" || req.path === "/api/health",
});

app.use("/api/", limiter);

// Stricter rate limiting for auth routes
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: config.env === "production" ? 10 : 100, // Tightened from 20 to 10
  message: "Too many authentication attempts, please try again in an hour.",
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);

// Body parser
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Data sanitization against NoSQL query injection / parameter pollution
// Even with Prisma, it's good practice to strip out keys starting with '$' or '.'
app.use(mongoSanitize());

// Gzip compression for all responses
app.use(compression());

// Per-user rate limiting (extracts user ID from JWT, then applies per-user limits)
app.use("/api/", extractUserIdForRateLimit);
app.use("/api/", perUserRateLimiter);

// CSRF protection – validates Origin/Referer on mutating requests
app.use("/api/", csrfProtection);

// Root health check
app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

// Sentry debug route (optional, to test sentry)
app.get("/debug-sentry", function mainHandler(req, res) {
  throw new Error("My first Sentry error!");
});

// API routes — unversioned (backwards compatibility)
app.use("/api", routes);

// API routes — versioned (v1)
app.use("/api/v1", routes);

// The error handler must be registered before any other error middleware and after all controllers
Sentry.setupExpressErrorHandler(app);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
