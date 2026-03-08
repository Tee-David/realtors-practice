import { Router } from "express";
import { SearchController } from "../controllers/search.controller";
import rateLimit from "express-rate-limit";

const router = Router();

// Rate limiting for public search (to prevent scraping our API)
const searchLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 200, // Limit each IP to 200 requests per 5 minutes
  message: "Too many search requests, please try again later.",
});

router.use(searchLimiter);

router.get("/", SearchController.search);
router.get("/suggestions", SearchController.getSuggestions);

export default router;
