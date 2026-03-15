import { Router } from "express";
import { SystemSettingsController } from "../controllers/systemSettings.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { authorize } from "../middlewares/role.middleware";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Settings
 *   description: System-wide configuration settings
 */

router.use(authenticate);

/**
 * @swagger
 * /settings:
 *   get:
 *     summary: List all system settings
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All settings grouped by category
 */
router.get("/", SystemSettingsController.list);

/**
 * @swagger
 * /settings/defaults:
 *   get:
 *     summary: Get default system setting values
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Default settings
 */
router.get("/defaults", SystemSettingsController.getDefaults);

/**
 * @swagger
 * /settings/{category}:
 *   get:
 *     summary: Get settings by category
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: category
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Settings for the category
 */
router.get("/:category", SystemSettingsController.getByCategory);

/**
 * @swagger
 * /settings:
 *   put:
 *     summary: Bulk update system settings (Admin only)
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Settings updated
 *       403:
 *         description: Admin role required
 */
router.put("/", authorize("ADMIN"), SystemSettingsController.bulkUpdate);

/**
 * @swagger
 * /settings/{key}:
 *   put:
 *     summary: Update a single setting by key (Admin only)
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Setting updated
 *       403:
 *         description: Admin role required
 */
router.put("/:key", authorize("ADMIN"), SystemSettingsController.update);

export default router;
