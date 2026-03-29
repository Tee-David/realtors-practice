export type PropertyCategory = "RESIDENTIAL" | "COMMERCIAL" | "LAND" | "SHORTLET" | "INDUSTRIAL";
export type ListingType = "SALE" | "RENT" | "LEASE" | "SHORTLET";
export type PropertyStatus = "AVAILABLE" | "SOLD" | "RENTED" | "UNDER_OFFER" | "WITHDRAWN" | "EXPIRED";
export type VerificationStatus = "UNVERIFIED" | "VERIFIED" | "FLAGGED" | "REJECTED";
export type Furnishing = "FURNISHED" | "SEMI_FURNISHED" | "UNFURNISHED" | "UNKNOWN";
export type PropertyCondition = "NEW" | "GOOD" | "FAIR" | "NEEDS_RENOVATION" | "UNKNOWN";
export type ChangeSource = "SCRAPER" | "MANUAL_EDIT" | "ENRICHMENT" | "SYSTEM";

export interface Property {
  id: string;
  hash: string;
  title: string;
  listingUrl: string;
  source: string;
  siteId: string;
  site?: { id: string; name: string; key: string; baseUrl?: string };
  status: PropertyStatus;
  verificationStatus: VerificationStatus;
  listingType: ListingType;
  category: PropertyCategory;
  // Details
  propertyType?: string;
  propertySubtype?: string;
  bedrooms?: number;
  bathrooms?: number;
  toilets?: number;
  bq?: number;
  landSize?: string;
  landSizeSqm?: number;
  buildingSize?: string;
  buildingSizeSqm?: number;
  plotDimensions?: string;
  yearBuilt?: number;
  renovationYear?: number;
  furnishing: Furnishing;
  condition: PropertyCondition;
  floors?: number;
  unitsAvailable?: number;
  description?: string;
  // Financial
  price?: number;
  priceCurrency: string;
  pricePerSqm?: number;
  pricePerBedroom?: number;
  initialDeposit?: number;
  paymentPlan?: string;
  serviceCharge?: number;
  serviceChargeFreq?: string;
  legalFees?: number;
  agentCommission?: number;
  priceNegotiable?: boolean;
  rentFrequency?: string;
  // Location
  fullAddress?: string;
  locationText?: string;
  estateName?: string;
  streetName?: string;
  area?: string;
  lga?: string;
  state?: string;
  country: string;
  latitude?: number;
  longitude?: number;
  landmarks: string[];
  // Amenities
  features: string[];
  security: string[];
  utilities: string[];
  parkingSpaces?: number;
  // Media
  images?: string[];
  videos?: string[];
  virtualTourUrl?: string;
  floorPlanUrl?: string;
  // Agent
  agentName?: string;
  agentPhone?: string;
  agentEmail?: string;
  contactInfo?: string;
  agencyName?: string;
  agencyLogo?: string;
  agentType?: "OWNERS_AGENT" | "DEVELOPER" | "LANDLORD";
  agentVerified: boolean;
  // Metadata
  qualityScore?: number;
  scrapeTimestamp?: string;
  lastVerifiedAt?: string;
  viewCount: number;
  inquiryCount: number;
  favoriteCount: number;
  daysOnMarket?: number;
  searchKeywords: string[];
  // Tags
  promoTags: string[];
  titleTag?: string;
  isPremium: boolean;
  isFeatured: boolean;
  isHotDeal: boolean;
  // Version
  currentVersion: number;
  _count?: { versions: number; priceHistory: number };
  // Timestamps
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface PropertyVersion {
  id: string;
  propertyId: string;
  version: number;
  changeSource: ChangeSource;
  changedBy?: string;
  editor?: { id: string; email: string; firstName?: string; lastName?: string };
  changeSummary?: string;
  previousData: Record<string, unknown>;
  newData: Record<string, unknown>;
  changedFields: string[];
  createdAt: string;
}

export interface PriceHistoryEntry {
  id: string;
  propertyId: string;
  price: number;
  source: string;
  recordedAt: string;
}

export interface PropertyFilters {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  listingType?: ListingType[];
  category?: PropertyCategory[];
  status?: PropertyStatus;
  verificationStatus?: VerificationStatus;
  minPrice?: number;
  maxPrice?: number;
  minBedrooms?: number;
  maxBedrooms?: number;
  minBathrooms?: number;
  state?: string;
  area?: string[];
  lga?: string;
  siteId?: string;
  propertyType?: string;
  furnishing?: Furnishing;
  search?: string;
  isPremium?: boolean;
  isFeatured?: boolean;
  minQualityScore?: number;
}

export interface PropertyStats {
  total: number;
  newToday: number;
  avgQualityScore: number;
  byCategory: { category: PropertyCategory; count: number }[];
  byListingType: { listingType: ListingType; count: number }[];
  byStatus: { status: PropertyStatus; count: number }[];
}

export interface Site {
  id: string;
  key: string;
  name: string;
  baseUrl: string;
  enabled: boolean;
  parser: string;
  listPaths: string[];
  selectors?: Record<string, unknown>;
  detailSelectors?: Record<string, unknown>;
  paginationType: string;
  maxPages: number;
  requiresBrowser: boolean;
  customHeaders?: Record<string, unknown>;
  lastScrapeAt?: string;
  lastSuccessAt?: string;
  failCount: number;
  avgListings: number;
  healthScore: number;
  _count?: { properties: number; scrapeJobs: number };
  createdAt: string;
  updatedAt: string;
}
