import { Router } from "express";
import { ScrapeController } from "../controllers/scrape.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { authorize } from "../middlewares/role.middleware";

const router = Router();

// All scrape routes require authentication
router.use(authenticate);

// Start a new scrape job (admin, editor)
router.post("/start", authorize("ADMIN", "EDITOR"), ScrapeController.startJob);

// List all scrape jobs
router.get("/jobs", ScrapeController.listJobs);

// Get a specific job with logs
router.get("/jobs/:id", ScrapeController.getJob);

// List scrape logs with filtering, pagination, and search
router.get("/logs", ScrapeController.listLogs);

// Get a single scrape log by ID
router.get("/logs/:id", ScrapeController.getLog);

// Stop a running job (admin, editor)
router.post("/jobs/:id/stop", authorize("ADMIN", "EDITOR"), ScrapeController.stopJob);

export default router;
