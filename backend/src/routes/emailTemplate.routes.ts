import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";
import { EmailTemplateController } from "../controllers/emailTemplate.controller";

const router = Router();

router.get("/", authenticate, EmailTemplateController.list);
router.get("/:name", authenticate, EmailTemplateController.getByName);
router.post("/", authenticate, EmailTemplateController.upsert);
router.delete("/:id", authenticate, EmailTemplateController.delete);

export default router;
