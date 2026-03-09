import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";
import { authorize } from "../middlewares/role.middleware";
import { EnvController } from "../controllers/env.controller";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Environment
 *   description: Super Admin Environment Variable Operations
 */

/**
 * @swagger
 * /env:
 *   get:
 *     summary: Get all environment variables (Super Admin only)
 *     tags: [Environment]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved environment variables.
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Super Admin role required)
 *       404:
 *         description: .env file not found
 */
router.get("/", authenticate, authorize("ADMIN"), EnvController.getEnvVars);

/**
 * @swagger
 * /env:
 *   put:
 *     summary: Update the .env file with validation (Super Admin only)
 *     tags: [Environment]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - rawContent
 *             properties:
 *               rawContent:
 *                 type: string
 *     responses:
 *       200:
 *         description: Environment variables updated successfully.
 *       400:
 *         description: Invalid input or failed connection test.
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Super Admin role required)
 *       500:
 *         description: Internal server error.
 */
router.put("/", authenticate, authorize("ADMIN"), EnvController.updateEnvVars);

export default router;
