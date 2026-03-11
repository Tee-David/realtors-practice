import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";
import { authorize } from "../middlewares/role.middleware";
import { AuditLogController } from "../controllers/auditLog.controller";

const router = Router();

// All routes require admin authentication
router.use(authenticate, authorize("ADMIN"));

router.get("/", AuditLogController.list);
router.get("/:id", AuditLogController.getById);

export default router;
