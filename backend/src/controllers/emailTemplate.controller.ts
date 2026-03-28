import { Request, Response } from "express";
import prisma from "../prismaClient";
import { sendSuccess, sendError } from "../utils/apiResponse.util";
import { z } from "zod";

const createTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  html: z.string().min(1),
  design: z.any().optional(),
});

const updateTemplateSchema = z.object({
  html: z.string().min(1).optional(),
  design: z.any().optional(),
  name: z.string().min(1).max(255).optional(),
});

export class EmailTemplateController {
  /**
   * List all email templates for the authenticated user
   */
  public static async list(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) return sendError(res, "Unauthorized", 401);

      const templates = await prisma.emailTemplate.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          name: true,
          html: true,
          design: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return sendSuccess(res, templates);
    } catch (error: any) {
      return sendError(res, error.message || "Failed to fetch email templates");
    }
  }

  /**
   * Get a single email template by name
   */
  public static async getByName(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) return sendError(res, "Unauthorized", 401);

      const { name } = req.params;

      const template = await prisma.emailTemplate.findUnique({
        where: { name_userId: { name, userId } },
        select: {
          id: true,
          name: true,
          html: true,
          design: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!template) return sendError(res, "Template not found", 404);
      return sendSuccess(res, template);
    } catch (error: any) {
      return sendError(res, error.message || "Failed to fetch email template");
    }
  }

  /**
   * Create or update an email template (upsert by name)
   */
  public static async upsert(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) return sendError(res, "Unauthorized", 401);

      const data = createTemplateSchema.parse(req.body);

      const template = await prisma.emailTemplate.upsert({
        where: { name_userId: { name: data.name, userId } },
        update: {
          html: data.html,
          design: data.design ?? undefined,
        },
        create: {
          name: data.name,
          html: data.html,
          design: data.design ?? undefined,
          userId,
        },
        select: {
          id: true,
          name: true,
          html: true,
          design: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return sendSuccess(res, template, "Email template saved");
    } catch (error: any) {
      return sendError(res, error.message || "Failed to save email template");
    }
  }

  /**
   * Delete an email template
   */
  public static async delete(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) return sendError(res, "Unauthorized", 401);

      const { id } = req.params;

      const template = await prisma.emailTemplate.findFirst({
        where: { id, userId },
      });

      if (!template) return sendError(res, "Template not found", 404);

      await prisma.emailTemplate.delete({ where: { id } });
      return sendSuccess(res, null, "Email template deleted");
    } catch (error: any) {
      return sendError(res, error.message || "Failed to delete email template");
    }
  }
}
