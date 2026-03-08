import { Router } from "express";
import { SiteController } from "../controllers/site.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { authorize } from "../middlewares/role.middleware";
import { validate } from "../middlewares/validation.middleware";
import { createSiteSchema, updateSiteSchema, listSitesSchema } from "../validators/site.validators";

const router = Router();

router.use(authenticate);

router.get("/", validate(listSitesSchema, "query"), SiteController.list);
router.get("/:id", SiteController.getById);
router.post("/", authorize("ADMIN"), validate(createSiteSchema), SiteController.create);
router.put("/:id", authorize("ADMIN"), validate(updateSiteSchema), SiteController.update);
router.patch("/:id/toggle", authorize("ADMIN"), SiteController.toggleEnabled);
router.delete("/:id", authorize("ADMIN"), SiteController.delete);

export default router;
