import { Router } from "express";
import { SiteController } from "../controllers/site.controller";
import { authenticate } from "../middlewares/auth.middleware";

import { validate } from "../middlewares/validation.middleware";
import { createSiteSchema, updateSiteSchema, listSitesSchema } from "../validators/site.validators";

const router = Router();

router.use(authenticate);

router.get("/", validate(listSitesSchema, "query"), SiteController.list);
router.get("/:id", SiteController.getById);
router.post("/", validate(createSiteSchema), SiteController.create);
router.put("/:id", validate(updateSiteSchema), SiteController.update);
router.patch("/:id/toggle", SiteController.toggleEnabled);
router.delete("/:id", SiteController.delete);

export default router;
