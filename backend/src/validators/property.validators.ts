import { z } from "zod";

export const listPropertiesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(["createdAt", "updatedAt", "price", "qualityScore", "bedrooms", "daysOnMarket"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  // Filters
  listingType: z.union([
    z.enum(["SALE", "RENT", "LEASE", "SHORTLET"]),
    z.array(z.enum(["SALE", "RENT", "LEASE", "SHORTLET"]))
  ]).optional().transform(val => val ? (Array.isArray(val) ? val : [val]) : undefined),
  category: z.union([
    z.enum(["RESIDENTIAL", "COMMERCIAL", "LAND", "SHORTLET", "INDUSTRIAL"]),
    z.array(z.enum(["RESIDENTIAL", "COMMERCIAL", "LAND", "SHORTLET", "INDUSTRIAL"]))
  ]).optional().transform(val => val ? (Array.isArray(val) ? val : [val]) : undefined),
  status: z.enum(["AVAILABLE", "SOLD", "RENTED", "UNDER_OFFER", "WITHDRAWN", "EXPIRED"]).optional(),
  verificationStatus: z.enum(["UNVERIFIED", "VERIFIED", "FLAGGED", "REJECTED"]).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  minBedrooms: z.coerce.number().int().min(0).optional(),
  maxBedrooms: z.coerce.number().int().min(0).optional(),
  minBathrooms: z.coerce.number().int().min(0).optional(),
  state: z.string().optional(),
  area: z.union([z.string(), z.array(z.string())]).optional().transform(val => val ? (Array.isArray(val) ? val : [val]) : undefined),
  lga: z.string().optional(),
  siteId: z.string().optional(),
  propertyType: z.string().optional(),
  furnishing: z.enum(["FURNISHED", "SEMI_FURNISHED", "UNFURNISHED", "UNKNOWN"]).optional(),
  search: z.string().optional(),
  isPremium: z.coerce.boolean().optional(),
  isFeatured: z.coerce.boolean().optional(),
  minQualityScore: z.coerce.number().min(0).max(100).optional(),
});

export const createPropertySchema = z.object({
  title: z.string().min(3).max(500),
  listingUrl: z.string().url(),
  source: z.string().min(1),
  siteId: z.string(),
  listingType: z.enum(["SALE", "RENT", "LEASE", "SHORTLET"]),
  category: z.enum(["RESIDENTIAL", "COMMERCIAL", "LAND", "SHORTLET", "INDUSTRIAL"]).default("RESIDENTIAL"),
  // Details
  propertyType: z.string().optional(),
  propertySubtype: z.string().optional(),
  bedrooms: z.number().int().min(0).optional(),
  bathrooms: z.number().int().min(0).optional(),
  toilets: z.number().int().min(0).optional(),
  bq: z.number().int().min(0).optional(),
  landSize: z.string().optional(),
  landSizeSqm: z.number().min(0).optional(),
  buildingSize: z.string().optional(),
  buildingSizeSqm: z.number().min(0).optional(),
  plotDimensions: z.string().optional(),
  yearBuilt: z.number().int().optional(),
  renovationYear: z.number().int().optional(),
  furnishing: z.enum(["FURNISHED", "SEMI_FURNISHED", "UNFURNISHED", "UNKNOWN"]).optional(),
  condition: z.enum(["NEW", "GOOD", "FAIR", "NEEDS_RENOVATION", "UNKNOWN"]).optional(),
  floors: z.number().int().min(0).optional(),
  unitsAvailable: z.number().int().min(0).optional(),
  description: z.string().optional(),
  // Financial
  price: z.number().min(0).optional(),
  priceCurrency: z.string().default("NGN"),
  pricePerSqm: z.number().min(0).optional(),
  pricePerBedroom: z.number().min(0).optional(),
  initialDeposit: z.number().min(0).optional(),
  paymentPlan: z.string().optional(),
  serviceCharge: z.number().min(0).optional(),
  serviceChargeFreq: z.string().optional(),
  legalFees: z.number().min(0).optional(),
  agentCommission: z.number().min(0).optional(),
  priceNegotiable: z.boolean().optional(),
  rentFrequency: z.string().optional(),
  // Location
  fullAddress: z.string().optional(),
  locationText: z.string().optional(),
  estateName: z.string().optional(),
  streetName: z.string().optional(),
  area: z.string().optional(),
  lga: z.string().optional(),
  state: z.string().optional(),
  country: z.string().default("Nigeria"),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  landmarks: z.array(z.string()).optional(),
  // Amenities
  features: z.array(z.string()).optional(),
  security: z.array(z.string()).optional(),
  utilities: z.array(z.string()).optional(),
  parkingSpaces: z.number().int().min(0).optional(),
  // Media
  images: z.any().optional(),
  videos: z.any().optional(),
  virtualTourUrl: z.string().url().optional(),
  floorPlanUrl: z.string().url().optional(),
  // Agent
  agentName: z.string().optional(),
  agentPhone: z.string().optional(),
  agentEmail: z.string().email().optional(),
  contactInfo: z.string().optional(),
  agencyName: z.string().optional(),
  agencyLogo: z.string().optional(),
  agentVerified: z.boolean().optional(),
  // Metadata
  scrapeTimestamp: z.string().datetime().optional(),
  searchKeywords: z.array(z.string()).optional(),
  // Tags
  promoTags: z.array(z.string()).optional(),
  titleTag: z.string().optional(),
  isPremium: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  isHotDeal: z.boolean().optional(),
});

export const updatePropertySchema = createPropertySchema.partial().omit({
  listingUrl: true,
  source: true,
  siteId: true,
});

export const bulkActionSchema = z.object({
  ids: z.array(z.string()).min(1).max(100),
  action: z.enum([
    "verify", "reject", "flag", "delete", "restore",
    "status_available", "status_sold", "status_expired", "status_rented",
  ]),
});

export type ListPropertiesInput = z.infer<typeof listPropertiesSchema>;
export type CreatePropertyInput = z.infer<typeof createPropertySchema>;
export type UpdatePropertyInput = z.infer<typeof updatePropertySchema>;
