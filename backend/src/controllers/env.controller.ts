import { Request, Response } from "express";
import fs from "fs/promises";
import path from "path";
import dotenv from "dotenv";
import { sendSuccess, sendError } from "../utils/apiResponse.util";
import { PrismaClient } from "@prisma/client";

const envFilePath = path.join(__dirname, "../../../.env");

export class EnvController {
  /**
   * Get all environment variables from the .env file.
   * Only the super admin is allowed to access this endpoint.
   */
  public static async getEnvVars(req: Request, res: Response) {
    try {
      // Ensure only Super Admin can access
      if (req.user!.email.toLowerCase() !== "wedigcreativity@gmail.com") {
        return sendError(res, "Only the Super Admin can access environment variables", 403);
      }

      await fs.access(envFilePath, fs.constants.R_OK);

      const rawEnv = await fs.readFile(envFilePath, 'utf8');
      const parsedEnv = dotenv.parse(rawEnv);

      // Return raw string so we can manage comments and formatting if we prefer,
      // but returning parsed is safer for structured editing.
      return sendSuccess(res, { variables: parsedEnv, raw: rawEnv });
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return sendError(res, ".env file not found", 404);
      }
      return sendError(res, error.message || "Failed to read .env file", 500);
    }
  }

  /**
   * Update the .env file.
   * Requires a full string payload of the new `.env` file content.
   * Tests parsing and database connection before applying.
   */
  public static async updateEnvVars(req: Request, res: Response) {
    try {
       // Ensure only Super Admin can access
       if (req.user!.email.toLowerCase() !== "wedigcreativity@gmail.com") {
        return sendError(res, "Only the Super Admin can modify environment variables", 403);
      }

      const { rawContent } = req.body;
      if (typeof rawContent !== "string") {
        return sendError(res, "Invalid payload. Expected full .env string.", 400);
      }

      // 1. Validation Pre-Save: Check if dotenv can parse it
      let parsedNewEnv;
      try {
        parsedNewEnv = dotenv.parse(rawContent);
      } catch (parseError) {
        return sendError(res, "Syntax Error: The provided .env content is invalid.", 400);
      }

      // 2. Validate Critical Connections (Database)
      if (parsedNewEnv.DATABASE_URL) {
        try {
          // Create an ephemeral Prisma client with the new URL
          const testPrisma = new PrismaClient({
            datasources: {
              db: {
                url: parsedNewEnv.DATABASE_URL,
              },
            },
          });
          
          await testPrisma.$connect();
          await testPrisma.$queryRaw`SELECT 1`; // Execute minimal query
          await testPrisma.$disconnect();
        } catch (dbError: any) {
           return sendError(res, `Failed Database Test with new DATABASE_URL: ${dbError.message}`, 400);
        }
      }

      // 3. Write updates to disk
      await fs.writeFile(envFilePath, rawContent, 'utf8');

      // (Optional) Process exit to trigger restart via nodemon/pm2, depending on deployment setup.
      // But we will just return success for the admin to restart manually or let hot-reload handle it.
      return sendSuccess(res, null, "Environment variables updated successfully. The server may require a restart to apply some changes.");

    } catch (error: any) {
      return sendError(res, error.message || "Failed to update .env", 500);
    }
  }
}
