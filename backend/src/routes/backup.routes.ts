import { Router } from "express";
import { BackupController } from "../controllers/backup.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { authorize } from "../middlewares/role.middleware";

const router = Router();

router.use(authenticate);
router.use(authorize("ADMIN"));

router.post("/", BackupController.create);
router.get("/", BackupController.list);
router.get("/schedule", BackupController.getSchedule);
router.put("/schedule", BackupController.setSchedule);
router.get("/:id/download", BackupController.download);
router.post("/:id/restore", BackupController.restore);
router.delete("/:id", BackupController.remove);

export default router;
