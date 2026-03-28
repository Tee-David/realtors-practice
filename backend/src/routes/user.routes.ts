import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";
import { authorize } from "../middlewares/role.middleware";
import { UserController } from "../controllers/user.controller";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: User Management Operations
 */

/**
 * @swagger
 * /users:
 *   get:
 *     summary: List all users
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A list of users.
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Admin role required)
 */
router.get("/", authenticate, authorize("ADMIN"), UserController.getAllUsers);

// /me routes must come before /:id routes to avoid "me" being treated as an ID
router.patch("/me", authenticate, UserController.updateProfile);
router.get("/me/notification-preferences", authenticate, UserController.getNotificationPreferences);
router.patch("/me/notification-preferences", authenticate, UserController.updateNotificationPreferences);

/**
 * @swagger
 * /users/{id}/role:
 *   patch:
 *     summary: Update a user's role (e.g. approve PENDING_ADMIN)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The user ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - role
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [ADMIN, PENDING_ADMIN, EDITOR, VIEWER, API_USER]
 *     responses:
 *       200:
 *         description: Role updated successfully.
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Admin role required, or attempting to modify the super admin)
 *       404:
 *         description: User not found
 */
router.patch("/:id/role", authenticate, authorize("ADMIN"), UserController.updateUserRole);
router.patch("/:id/toggle-active", authenticate, authorize("ADMIN"), UserController.toggleActive);
router.delete("/:id", authenticate, authorize("ADMIN"), UserController.deleteUser);

export default router;
