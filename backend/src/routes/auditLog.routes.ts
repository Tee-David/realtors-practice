import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";
import { authorize } from "../middlewares/role.middleware";
import { AuditLogController } from "../controllers/auditLog.controller";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: AuditLogs
 *   description: Audit trail for administrative actions
 */

// All routes require admin authentication
router.use(authenticate, authorize("ADMIN"));

/**
 * @swagger
 * /audit-logs:
 *   get:
 *     summary: List audit log entries
 *     tags: [AuditLogs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *       - in: query
 *         name: action
 *         schema: { type: string }
 *       - in: query
 *         name: entity
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Paginated audit logs
 *       403:
 *         description: Admin role required
 */
router.get("/", AuditLogController.list);

/**
 * @swagger
 * /audit-logs/{id}:
 *   get:
 *     summary: Get a single audit log entry
 *     tags: [AuditLogs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Audit log details
 *       403:
 *         description: Admin role required
 */
router.get("/:id", AuditLogController.getById);

export default router;
