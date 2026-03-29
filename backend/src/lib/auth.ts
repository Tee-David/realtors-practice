import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import prisma from "../prismaClient";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql", // CockroachDB is PostgreSQL-compatible
  }),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    },
  },

  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
    expiresIn: 60 * 60 * 24 * 30, // 30 days (remember me default)
    updateAge: 60 * 60 * 24, // Update session every 24 hours
  },

  advanced: {
    cookiePrefix: "rp",
    crossSubDomainCookies: {
      enabled: false,
    },
  },

  trustedOrigins: [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    process.env.CORS_ORIGIN || "http://localhost:3000",
    "https://realtors-practice-new.vercel.app",
  ].filter(Boolean),
});

export type Session = typeof auth.$Infer.Session;
