import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";
import { ExportController } from "../controllers/export.controller";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Export
 *   description: Data export (CSV, XLSX, PDF)
 */

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /export/csv:
 *   post:
 *     summary: Export all properties as CSV
 *     tags: [Export]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: CSV file download
 *         content:
 *           text/csv: {}
 */
router.post("/csv", ExportController.exportCSV);

/**
 * @swagger
 * /export/csv/filtered:
 *   post:
 *     summary: Export filtered properties as CSV
 *     tags: [Export]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ids:
 *                 type: array
 *                 items: { type: string }
 *     responses:
 *       200:
 *         description: Filtered CSV file download
 */
router.post("/csv/filtered", ExportController.exportFilteredCSV);

/**
 * @swagger
 * /export/xlsx:
 *   get:
 *     summary: Export properties as Excel spreadsheet
 *     tags: [Export]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: XLSX file download
 */
router.get("/xlsx", ExportController.exportXLSX);

/**
 * @swagger
 * /export/pdf:
 *   get:
 *     summary: Export properties as PDF report
 *     tags: [Export]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: PDF file download
 */
router.get("/pdf", ExportController.exportPDF);

export default router;
