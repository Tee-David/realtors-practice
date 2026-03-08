import { Router } from "express";
import { PropertyController } from "../controllers/property.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { authorize } from "../middlewares/role.middleware";
import { validate } from "../middlewares/validation.middleware";
import {
  listPropertiesSchema,
  createPropertySchema,
  updatePropertySchema,
  bulkActionSchema,
} from "../validators/property.validators";

const router = Router();

// All property routes require authentication
router.use(authenticate);

// List properties (all roles)
router.get("/", validate(listPropertiesSchema, "query"), PropertyController.list);

// Get property stats (all roles)
router.get("/stats", PropertyController.getStats);

// Get single property (all roles)
router.get("/:id", PropertyController.getById);

// Get property versions (all roles)
router.get("/:id/versions", PropertyController.getVersions);

// Get property price history (all roles)
router.get("/:id/price-history", PropertyController.getPriceHistory);

// Create property (admin, editor)
router.post("/", authorize("ADMIN", "EDITOR"), validate(createPropertySchema), PropertyController.create);

// Update property (admin, editor)
router.put("/:id", authorize("ADMIN", "EDITOR"), validate(updatePropertySchema), PropertyController.update);

// Enrich property (admin, editor)
router.patch("/:id/enrich", authorize("ADMIN", "EDITOR"), PropertyController.enrich);

// Bulk action (admin only)
router.post("/bulk-action", authorize("ADMIN"), validate(bulkActionSchema), PropertyController.bulkAction);

// Delete property (admin only)
router.delete("/:id", authorize("ADMIN"), PropertyController.delete);

export default router;
