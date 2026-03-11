import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";
import { ExportController } from "../controllers/export.controller";

const router = Router();

// All routes require authentication
router.use(authenticate);

router.post("/csv", ExportController.exportCSV);
router.post("/csv/filtered", ExportController.exportFilteredCSV);

export default router;
