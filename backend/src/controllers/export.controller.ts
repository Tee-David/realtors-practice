import { Request, Response } from "express";
import { ExportService } from "../services/export.service";
import { sendError } from "../utils/apiResponse.util";
import { z } from "zod";

const exportByIdsSchema = z.object({
  propertyIds: z.array(z.string()).optional(),
});

const exportFilteredSchema = z.object({
  listingType: z.string().optional(),
  category: z.string().optional(),
  state: z.string().optional(),
  area: z.string().optional(),
  minPrice: z.number().optional(),
  maxPrice: z.number().optional(),
  status: z.string().optional(),
  verificationStatus: z.string().optional(),
});

export class ExportController {
  /**
   * Export properties to CSV by IDs
   */
  static async exportCSV(req: Request, res: Response) {
    try {
      const { propertyIds } = exportByIdsSchema.parse(req.body);
      const csv = await ExportService.exportCSV(propertyIds);

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename=properties-${Date.now()}.csv`);
      return res.send(csv);
    } catch (err: any) {
      if (err.name === "ZodError") {
        return sendError(res, "Invalid input", 400);
      }
      return sendError(res, err.message || "Failed to export");
    }
  }

  /**
   * Export properties to CSV by filters
   */
  static async exportFilteredCSV(req: Request, res: Response) {
    try {
      const filters = exportFilteredSchema.parse(req.body);
      const csv = await ExportService.exportFilteredCSV(filters);

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename=properties-filtered-${Date.now()}.csv`);
      return res.send(csv);
    } catch (err: any) {
      if (err.name === "ZodError") {
        return sendError(res, "Invalid input", 400);
      }
      return sendError(res, err.message || "Failed to export");
    }
  }
}
