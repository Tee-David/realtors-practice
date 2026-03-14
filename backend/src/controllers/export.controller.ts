import { Request, Response } from "express";
import { ExportService } from "../services/export.service";
import { sendError } from "../utils/apiResponse.util";
import { z } from "zod";
import { logAudit, getClientInfo } from "../middlewares/auditLog.middleware";

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

      void logAudit({
        userId: (req as any).user?.id,
        action: "EXPORT_CSV",
        entity: "Property",
        details: { type: "byIds", count: propertyIds?.length },
        ...getClientInfo(req),
      });
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

      void logAudit({
        userId: (req as any).user?.id,
        action: "EXPORT_CSV",
        entity: "Property",
        details: { type: "filtered", filters },
        ...getClientInfo(req),
      });
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

  /**
   * Export properties to XLSX
   */
  static async exportXLSX(req: Request, res: Response) {
    try {
      const { propertyIds, ...filterParams } = req.query;

      let buffer: Buffer;

      if (propertyIds) {
        const ids = String(propertyIds).split(",").map((id) => id.trim()).filter(Boolean);
        buffer = await ExportService.exportXLSX(ids.length > 0 ? ids : undefined);
      } else {
        const filters: Record<string, any> = {};
        if (filterParams.listingType) filters.listingType = String(filterParams.listingType);
        if (filterParams.category) filters.category = String(filterParams.category);
        if (filterParams.state) filters.state = String(filterParams.state);
        if (filterParams.minPrice) filters.minPrice = Number(filterParams.minPrice);
        if (filterParams.maxPrice) filters.maxPrice = Number(filterParams.maxPrice);
        if (filterParams.status) filters.status = String(filterParams.status);

        const hasFilters = Object.keys(filters).length > 0;
        buffer = hasFilters
          ? await ExportService.exportFilteredXLSX(filters)
          : await ExportService.exportXLSX();
      }

      void logAudit({
        userId: (req as any).user?.id,
        action: "EXPORT_XLSX",
        entity: "Property",
        details: { type: propertyIds ? "byIds" : "filtered" },
        ...getClientInfo(req),
      });

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=properties-export.xlsx");
      return res.send(buffer);
    } catch (err: any) {
      return sendError(res, err.message || "Failed to export XLSX");
    }
  }

  /**
   * Export properties to PDF
   */
  static async exportPDF(req: Request, res: Response) {
    try {
      const { propertyIds, ...filterParams } = req.query;

      let buffer: Buffer;

      if (propertyIds) {
        const ids = String(propertyIds).split(",").map((id) => id.trim()).filter(Boolean);
        buffer = await ExportService.exportPDF(ids.length > 0 ? ids : undefined);
      } else {
        const filters: Record<string, any> = {};
        if (filterParams.listingType) filters.listingType = String(filterParams.listingType);
        if (filterParams.category) filters.category = String(filterParams.category);
        if (filterParams.state) filters.state = String(filterParams.state);
        if (filterParams.minPrice) filters.minPrice = Number(filterParams.minPrice);
        if (filterParams.maxPrice) filters.maxPrice = Number(filterParams.maxPrice);
        if (filterParams.status) filters.status = String(filterParams.status);

        const hasFilters = Object.keys(filters).length > 0;
        buffer = hasFilters
          ? await ExportService.exportFilteredPDF(filters)
          : await ExportService.exportPDF();
      }

      void logAudit({
        userId: (req as any).user?.id,
        action: "EXPORT_PDF",
        entity: "Property",
        details: { type: propertyIds ? "byIds" : "filtered" },
        ...getClientInfo(req),
      });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "attachment; filename=properties-export.pdf");
      return res.send(buffer);
    } catch (err: any) {
      return sendError(res, err.message || "Failed to export PDF");
    }
  }
}
