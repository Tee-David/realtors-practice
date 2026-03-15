import { Router } from "express";
import { MarketController } from "../controllers/market.controller";
import { authenticate } from "../middlewares/auth.middleware";

const router = Router();

// All market routes require authentication
router.use(authenticate);

// Market intelligence endpoints
router.get("/price-per-sqm", MarketController.getPricePerSqm);
router.get("/rental-yield", MarketController.getRentalYield);
router.get("/days-on-market", MarketController.getDaysOnMarket);
router.get("/comparables/:propertyId", MarketController.getComparableProperties);
router.get("/report", MarketController.getMarketReport);

// Search analytics
router.get("/zero-result-searches", MarketController.getZeroResultSearches);
router.post("/log-search", MarketController.logSearchQuery);

// Taxonomy endpoints
router.get("/taxonomy/normalize", MarketController.normalizeTerm);
router.get("/taxonomy/synonyms", MarketController.getSynonyms);

export default router;
