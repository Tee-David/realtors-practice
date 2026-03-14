import prisma from "../prismaClient";
import { Logger } from "../utils/logger.util";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";

const CSV_FIELDS = [
  "id", "title", "listingType", "category", "propertyType", "status",
  "price", "priceCurrency", "bedrooms", "bathrooms", "toilets",
  "landSizeSqm", "buildingSizeSqm", "furnishing", "condition",
  "fullAddress", "area", "lga", "state", "latitude", "longitude",
  "features", "agentName", "agentPhone", "agencyName",
  "qualityScore", "source", "listingUrl", "createdAt", "updatedAt"
];

const PDF_FIELDS = [
  "title", "listingType", "category", "price", "bedrooms",
  "area", "state", "status", "qualityScore"
];

function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export class ExportService {
  /**
   * Export properties to CSV format
   */
  static async exportCSV(propertyIds?: string[]): Promise<string> {
    const where: any = { deletedAt: null };
    if (propertyIds && propertyIds.length > 0) {
      where.id = { in: propertyIds };
    }

    const properties = await prisma.property.findMany({
      where,
      take: 10000, // safety cap
      orderBy: { createdAt: "desc" },
    });

    // Build CSV header
    const header = CSV_FIELDS.join(",");

    // Build CSV rows
    const rows = properties.map((prop: any) => {
      return CSV_FIELDS.map((field) => {
        let value = prop[field];

        // Handle arrays
        if (Array.isArray(value)) {
          value = value.join("; ");
        }

        // Handle dates
        if (value instanceof Date) {
          value = value.toISOString();
        }

        return escapeCsvValue(value);
      }).join(",");
    });

    // Branded comment header
    const dateStr = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    const brandLine = `# Realtors' Practice — Property Export`;
    const dateLine = `# Generated on ${dateStr} | ${properties.length} properties`;

    Logger.info(`[Export] Generated CSV with ${properties.length} properties`);
    return [brandLine, dateLine, header, ...rows].join("\n");
  }

  /**
   * Export filtered properties to CSV
   */
  static async exportFilteredCSV(filters: {
    listingType?: string;
    category?: string;
    state?: string;
    area?: string;
    minPrice?: number;
    maxPrice?: number;
    status?: string;
    verificationStatus?: string;
  }): Promise<string> {
    const where: any = { deletedAt: null };

    if (filters.listingType) where.listingType = filters.listingType;
    if (filters.category) where.category = filters.category;
    if (filters.state) where.state = filters.state;
    if (filters.area) where.area = { contains: filters.area, mode: "insensitive" };
    if (filters.status) where.status = filters.status;
    if (filters.verificationStatus) where.verificationStatus = filters.verificationStatus;
    if (filters.minPrice || filters.maxPrice) {
      where.price = {};
      if (filters.minPrice) where.price.gte = filters.minPrice;
      if (filters.maxPrice) where.price.lte = filters.maxPrice;
    }

    const ids = (
      await prisma.property.findMany({
        where,
        select: { id: true },
        take: 10000,
      })
    ).map((p) => p.id);

    return this.exportCSV(ids);
  }

  /**
   * Export properties to XLSX format
   */
  static async exportXLSX(propertyIds?: string[]): Promise<Buffer> {
    const where: any = { deletedAt: null };
    if (propertyIds && propertyIds.length > 0) {
      where.id = { in: propertyIds };
    }

    const properties = await prisma.property.findMany({
      where,
      take: 10000,
      orderBy: { createdAt: "desc" },
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Realtors' Practice";
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet("Properties");

    // Row 1: Branded header merged across all columns
    const headerRow = worksheet.addRow(["Realtors' Practice — Property Export"]);
    worksheet.mergeCells(1, 1, 1, CSV_FIELDS.length);
    headerRow.getCell(1).font = { bold: true, color: { argb: "FFFFFFFF" }, size: 14 };
    headerRow.getCell(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0001FC" },
    };
    headerRow.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
    headerRow.height = 30;

    // Row 2: Generation date
    const dateStr = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    const dateRow = worksheet.addRow([`Generated on ${dateStr}`]);
    worksheet.mergeCells(2, 1, 2, CSV_FIELDS.length);
    dateRow.getCell(1).font = { italic: true, size: 10 };
    dateRow.getCell(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFD9D9D9" },
    };
    dateRow.getCell(1).alignment = { horizontal: "center" };

    // Row 3: Column headers
    const colHeaderRow = worksheet.addRow(CSV_FIELDS);
    colHeaderRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FF000000" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFB3D4FF" },
      };
      cell.alignment = { horizontal: "center" };
    });

    // Data rows with alternating backgrounds
    properties.forEach((prop: any, index: number) => {
      const rowData = CSV_FIELDS.map((field) => {
        let value = prop[field];
        if (Array.isArray(value)) {
          value = value.join("; ");
        }
        if (value instanceof Date) {
          value = value.toISOString();
        }
        return value ?? "";
      });

      const dataRow = worksheet.addRow(rowData);
      if (index % 2 === 1) {
        dataRow.eachCell((cell) => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF2F2F2" },
          };
        });
      }
    });

    // Auto-width columns
    worksheet.columns.forEach((column) => {
      let maxLength = 10;
      column.eachCell?.({ includeEmpty: true }, (cell) => {
        const cellValue = cell.value ? String(cell.value) : "";
        maxLength = Math.max(maxLength, Math.min(cellValue.length + 2, 50));
      });
      column.width = maxLength;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    Logger.info(`[Export] Generated XLSX with ${properties.length} properties`);
    return Buffer.from(buffer);
  }

  /**
   * Export filtered properties to XLSX
   */
  static async exportFilteredXLSX(filters: {
    listingType?: string;
    category?: string;
    state?: string;
    area?: string;
    minPrice?: number;
    maxPrice?: number;
    status?: string;
    verificationStatus?: string;
  }): Promise<Buffer> {
    const where: any = { deletedAt: null };

    if (filters.listingType) where.listingType = filters.listingType;
    if (filters.category) where.category = filters.category;
    if (filters.state) where.state = filters.state;
    if (filters.area) where.area = { contains: filters.area, mode: "insensitive" };
    if (filters.status) where.status = filters.status;
    if (filters.verificationStatus) where.verificationStatus = filters.verificationStatus;
    if (filters.minPrice || filters.maxPrice) {
      where.price = {};
      if (filters.minPrice) where.price.gte = filters.minPrice;
      if (filters.maxPrice) where.price.lte = filters.maxPrice;
    }

    const ids = (
      await prisma.property.findMany({
        where,
        select: { id: true },
        take: 10000,
      })
    ).map((p) => p.id);

    return this.exportXLSX(ids);
  }

  /**
   * Export properties to PDF format
   */
  static async exportPDF(propertyIds?: string[]): Promise<Buffer> {
    const where: any = { deletedAt: null };
    if (propertyIds && propertyIds.length > 0) {
      where.id = { in: propertyIds };
    }

    const properties = await prisma.property.findMany({
      where,
      take: 10000,
      orderBy: { createdAt: "desc" },
    });

    return new Promise<Buffer>((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: "A4",
          layout: "landscape",
          margins: { top: 50, bottom: 50, left: 40, right: 40 },
          bufferPages: true,
        });

        const chunks: Buffer[] = [];
        doc.on("data", (chunk: Buffer) => chunks.push(chunk));
        doc.on("end", () => {
          const result = Buffer.concat(chunks);
          Logger.info(`[Export] Generated PDF with ${properties.length} properties`);
          resolve(result);
        });
        doc.on("error", reject);

        const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

        // Header
        doc
          .fontSize(22)
          .fillColor("#0001FC")
          .font("Helvetica-Bold")
          .text("Realtors' Practice", { align: "center" });

        doc
          .fontSize(14)
          .fillColor("#333333")
          .font("Helvetica")
          .text("Property Export Report", { align: "center" });

        doc.moveDown(0.5);

        const dateStr = new Date().toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
        doc
          .fontSize(9)
          .fillColor("#666666")
          .text(`Generated on ${dateStr}  |  ${properties.length} properties`, { align: "center" });

        doc.moveDown(1);

        // Table configuration
        const colWidths: number[] = [
          pageWidth * 0.18, // title
          pageWidth * 0.09, // listingType
          pageWidth * 0.09, // category
          pageWidth * 0.10, // price
          pageWidth * 0.07, // bedrooms
          pageWidth * 0.14, // area
          pageWidth * 0.10, // state
          pageWidth * 0.09, // status
          pageWidth * 0.08, // qualityScore
        ];
        const colLabels = ["Title", "Listing", "Category", "Price", "Beds", "Area", "State", "Status", "Score"];
        const rowHeight = 18;
        const headerHeight = 22;

        const drawTableHeader = (startY: number) => {
          let x = doc.page.margins.left;
          doc
            .rect(x, startY, pageWidth, headerHeight)
            .fill("#0001FC");

          colLabels.forEach((label, i) => {
            doc
              .fontSize(8)
              .fillColor("#FFFFFF")
              .font("Helvetica-Bold")
              .text(label, x + 3, startY + 5, {
                width: colWidths[i] - 6,
                height: headerHeight,
                ellipsis: true,
              });
            x += colWidths[i];
          });

          return startY + headerHeight;
        };

        let currentY = doc.y;
        currentY = drawTableHeader(currentY);

        // Data rows
        properties.forEach((prop: any, index: number) => {
          // Check if we need a new page
          if (currentY + rowHeight > doc.page.height - doc.page.margins.bottom - 30) {
            doc.addPage();
            currentY = doc.page.margins.top;
            currentY = drawTableHeader(currentY);
          }

          // Alternating row background
          if (index % 2 === 1) {
            doc
              .rect(doc.page.margins.left, currentY, pageWidth, rowHeight)
              .fill("#F2F2F2");
          }

          let x = doc.page.margins.left;
          PDF_FIELDS.forEach((field, i) => {
            let value = prop[field];
            if (value === null || value === undefined) value = "";
            if (Array.isArray(value)) value = value.join(", ");
            if (value instanceof Date) value = value.toISOString().split("T")[0];
            if (field === "price" && typeof value === "number") {
              value = value.toLocaleString("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 });
            }

            doc
              .fontSize(7)
              .fillColor("#333333")
              .font("Helvetica")
              .text(String(value), x + 3, currentY + 4, {
                width: colWidths[i] - 6,
                height: rowHeight,
                ellipsis: true,
              });
            x += colWidths[i];
          });

          currentY += rowHeight;
        });

        // Add watermark and page numbers to all pages
        const pages = doc.bufferedPageRange();
        for (let i = 0; i < pages.count; i++) {
          doc.switchToPage(i);

          // Watermark
          doc.save();
          doc
            .fontSize(60)
            .fillColor("#E0E0E0")
            .opacity(0.3)
            .translate(doc.page.width / 2, doc.page.height / 2)
            .rotate(-45, { origin: [0, 0] })
            .text("Realtors' Practice", -200, -30, {
              align: "center",
              width: 400,
            });
          doc.restore();

          // Page number
          doc
            .fontSize(8)
            .fillColor("#999999")
            .opacity(1)
            .text(
              `Page ${i + 1} of ${pages.count}`,
              doc.page.margins.left,
              doc.page.height - 35,
              { align: "center", width: pageWidth }
            );
        }

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Export filtered properties to PDF
   */
  static async exportFilteredPDF(filters: {
    listingType?: string;
    category?: string;
    state?: string;
    area?: string;
    minPrice?: number;
    maxPrice?: number;
    status?: string;
    verificationStatus?: string;
  }): Promise<Buffer> {
    const where: any = { deletedAt: null };

    if (filters.listingType) where.listingType = filters.listingType;
    if (filters.category) where.category = filters.category;
    if (filters.state) where.state = filters.state;
    if (filters.area) where.area = { contains: filters.area, mode: "insensitive" };
    if (filters.status) where.status = filters.status;
    if (filters.verificationStatus) where.verificationStatus = filters.verificationStatus;
    if (filters.minPrice || filters.maxPrice) {
      where.price = {};
      if (filters.minPrice) where.price.gte = filters.minPrice;
      if (filters.maxPrice) where.price.lte = filters.maxPrice;
    }

    const ids = (
      await prisma.property.findMany({
        where,
        select: { id: true },
        take: 10000,
      })
    ).map((p) => p.id);

    return this.exportPDF(ids);
  }
}
