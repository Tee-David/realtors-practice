import { Router } from "express";
import { BackupController } from "../controllers/backup.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { authorize } from "../middlewares/role.middleware";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Backups
 *   description: Database backup and restore (Admin only)
 */

router.use(authenticate);
router.use(authorize("ADMIN"));

/**
 * @swagger
 * /backups:
 *   post:
 *     summary: Create a new database backup
 *     tags: [Backups]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Backup created
 *       403:
 *         description: Admin role required
 */
router.post("/", BackupController.create);

/**
 * @swagger
 * /backups:
 *   get:
 *     summary: List all backups
 *     tags: [Backups]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of backups
 */
router.get("/", BackupController.list);

/**
 * @swagger
 * /backups/schedule:
 *   get:
 *     summary: Get the current backup schedule
 *     tags: [Backups]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Backup schedule configuration
 */
router.get("/schedule", BackupController.getSchedule);

/**
 * @swagger
 * /backups/schedule:
 *   put:
 *     summary: Update the backup schedule
 *     tags: [Backups]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Schedule updated
 */
router.put("/schedule", BackupController.setSchedule);

/**
 * @swagger
 * /backups/{id}/download:
 *   get:
 *     summary: Download a backup file
 *     tags: [Backups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Backup file download
 */
router.get("/:id/download", BackupController.download);

/**
 * @swagger
 * /backups/{id}/restore:
 *   post:
 *     summary: Restore from a backup
 *     tags: [Backups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Backup restored
 */
router.post("/:id/restore", BackupController.restore);

/**
 * @swagger
 * /backups/{id}:
 *   delete:
 *     summary: Delete a backup
 *     tags: [Backups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Backup deleted
 */
router.delete("/:id", BackupController.remove);

export default router;
