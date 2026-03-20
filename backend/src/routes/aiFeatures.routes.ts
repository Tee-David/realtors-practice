import { Router } from "express";
import { AIFeaturesController } from "../controllers/aiFeatures.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { authorize } from "../middlewares/role.middleware";

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * /settings/ai-features:
 *   get:
 *     summary: List all AI feature flags
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All AI feature flags with enabled/disabled status
 */
router.get("/", AIFeaturesController.list);

/**
 * @swagger
 * /settings/ai-features/{key}:
 *   patch:
 *     summary: Toggle an AI feature flag (Admin only)
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [enabled]
 *             properties:
 *               enabled: { type: boolean }
 *     responses:
 *       200:
 *         description: Feature flag toggled
 *       403:
 *         description: Admin role required
 */
router.patch("/:key", authorize("ADMIN"), AIFeaturesController.toggle);

export default router;
