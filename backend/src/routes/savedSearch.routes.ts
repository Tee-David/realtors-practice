import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";
import { SavedSearchController } from "../controllers/savedSearch.controller";

const router = Router();

// All routes require authentication
router.use(authenticate);

router.get("/", SavedSearchController.getAll);
router.post("/", SavedSearchController.create);
router.get("/:id", SavedSearchController.getById);
router.put("/:id", SavedSearchController.update);
router.delete("/:id", SavedSearchController.delete);
router.get("/:id/matches", SavedSearchController.getMatches);
router.patch("/:id/matches/seen", SavedSearchController.markMatchesSeen);

export default router;
