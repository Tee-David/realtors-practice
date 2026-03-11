import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";
import { NotificationController } from "../controllers/notification.controller";

const router = Router();

// All routes require authentication
router.use(authenticate);

router.get("/", NotificationController.list);
router.get("/unread-count", NotificationController.getUnreadCount);
router.patch("/:id/read", NotificationController.markRead);
router.patch("/read-all", NotificationController.markAllRead);

export default router;
