import { Router } from "express";
import { SystemSettingsController } from "../controllers/systemSettings.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { authorize } from "../middlewares/role.middleware";

const router = Router();

router.use(authenticate);

// Read routes — any authenticated user
router.get("/", SystemSettingsController.list);
router.get("/defaults", SystemSettingsController.getDefaults);
router.get("/:category", SystemSettingsController.getByCategory);

// Write routes — ADMIN only
router.put("/", authorize("ADMIN"), SystemSettingsController.bulkUpdate);
router.put("/:key", authorize("ADMIN"), SystemSettingsController.update);

export default router;
