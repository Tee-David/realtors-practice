-- CreateEnum
CREATE TYPE "PropertyCategory" AS ENUM ('RESIDENTIAL', 'COMMERCIAL', 'LAND', 'SHORTLET', 'INDUSTRIAL');

-- CreateEnum
CREATE TYPE "ListingType" AS ENUM ('SALE', 'RENT', 'LEASE', 'SHORTLET');

-- CreateEnum
CREATE TYPE "PropertyStatus" AS ENUM ('AVAILABLE', 'SOLD', 'RENTED', 'UNDER_OFFER', 'WITHDRAWN', 'EXPIRED');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('UNVERIFIED', 'VERIFIED', 'FLAGGED', 'REJECTED');

-- CreateEnum
CREATE TYPE "Furnishing" AS ENUM ('FURNISHED', 'SEMI_FURNISHED', 'UNFURNISHED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "PropertyCondition" AS ENUM ('NEW', 'GOOD', 'FAIR', 'NEEDS_RENOVATION', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ScrapeJobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ScrapeJobType" AS ENUM ('PASSIVE_BULK', 'ACTIVE_INTENT', 'RESCRAPE', 'SCHEDULED');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'PENDING_ADMIN', 'EDITOR', 'VIEWER', 'API_USER');

-- CreateEnum
CREATE TYPE "ChangeSource" AS ENUM ('SCRAPER', 'MANUAL_EDIT', 'ENRICHMENT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('NEW_MATCH', 'PRICE_DROP', 'SCRAPE_COMPLETE', 'SCRAPE_FAILED', 'SYSTEM');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "supabaseId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'VIEWER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "firstName" TEXT,
    "lastName" TEXT,
    "avatarUrl" TEXT,
    "phone" TEXT,
    "bio" TEXT,
    "company" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "loginCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Site" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "parser" TEXT NOT NULL DEFAULT 'universal',
    "listPaths" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "selectors" JSONB,
    "detailSelectors" JSONB,
    "paginationType" TEXT NOT NULL DEFAULT 'auto',
    "maxPages" INTEGER NOT NULL DEFAULT 30,
    "requiresBrowser" BOOLEAN NOT NULL DEFAULT false,
    "customHeaders" JSONB,
    "lastScrapeAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "failCount" INTEGER NOT NULL DEFAULT 0,
    "avgListings" INTEGER NOT NULL DEFAULT 0,
    "healthScore" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Site_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "listingUrl" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "status" "PropertyStatus" NOT NULL DEFAULT 'AVAILABLE',
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "listingType" "ListingType" NOT NULL,
    "category" "PropertyCategory" NOT NULL DEFAULT 'RESIDENTIAL',
    "propertyType" TEXT,
    "propertySubtype" TEXT,
    "bedrooms" INTEGER,
    "bathrooms" INTEGER,
    "toilets" INTEGER,
    "bq" INTEGER,
    "landSize" TEXT,
    "landSizeSqm" DOUBLE PRECISION,
    "buildingSize" TEXT,
    "buildingSizeSqm" DOUBLE PRECISION,
    "plotDimensions" TEXT,
    "yearBuilt" INTEGER,
    "renovationYear" INTEGER,
    "furnishing" "Furnishing" NOT NULL DEFAULT 'UNKNOWN',
    "condition" "PropertyCondition" NOT NULL DEFAULT 'UNKNOWN',
    "floors" INTEGER,
    "unitsAvailable" INTEGER,
    "description" TEXT,
    "price" DOUBLE PRECISION,
    "priceCurrency" TEXT NOT NULL DEFAULT 'NGN',
    "pricePerSqm" DOUBLE PRECISION,
    "pricePerBedroom" DOUBLE PRECISION,
    "initialDeposit" DOUBLE PRECISION,
    "paymentPlan" TEXT,
    "serviceCharge" DOUBLE PRECISION,
    "serviceChargeFreq" TEXT,
    "legalFees" DOUBLE PRECISION,
    "agentCommission" DOUBLE PRECISION,
    "priceNegotiable" BOOLEAN,
    "rentFrequency" TEXT,
    "fullAddress" TEXT,
    "locationText" TEXT,
    "estateName" TEXT,
    "streetName" TEXT,
    "area" TEXT,
    "lga" TEXT,
    "state" TEXT DEFAULT 'Lagos',
    "country" TEXT NOT NULL DEFAULT 'Nigeria',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "landmarks" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "security" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "utilities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "parkingSpaces" INTEGER,
    "images" JSONB,
    "videos" JSONB,
    "virtualTourUrl" TEXT,
    "floorPlanUrl" TEXT,
    "agentName" TEXT,
    "agentPhone" TEXT,
    "agentEmail" TEXT,
    "contactInfo" TEXT,
    "agencyName" TEXT,
    "agencyLogo" TEXT,
    "agentVerified" BOOLEAN NOT NULL DEFAULT false,
    "qualityScore" DOUBLE PRECISION,
    "scrapeTimestamp" TIMESTAMP(3),
    "lastVerifiedAt" TIMESTAMP(3),
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "inquiryCount" INTEGER NOT NULL DEFAULT 0,
    "favoriteCount" INTEGER NOT NULL DEFAULT 0,
    "daysOnMarket" INTEGER,
    "searchKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "promoTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "titleTag" TEXT,
    "isPremium" BOOLEAN NOT NULL DEFAULT false,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isHotDeal" BOOLEAN NOT NULL DEFAULT false,
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyVersion" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "changeSource" "ChangeSource" NOT NULL,
    "changedBy" TEXT,
    "changeSummary" TEXT,
    "previousData" JSONB NOT NULL,
    "newData" JSONB NOT NULL,
    "changedFields" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropertyVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceHistory" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScrapeJob" (
    "id" TEXT NOT NULL,
    "type" "ScrapeJobType" NOT NULL,
    "status" "ScrapeJobStatus" NOT NULL DEFAULT 'PENDING',
    "createdById" TEXT,
    "siteIds" TEXT[],
    "parameters" JSONB,
    "searchQuery" TEXT,
    "parsedFilters" JSONB,
    "totalListings" INTEGER NOT NULL DEFAULT 0,
    "newListings" INTEGER NOT NULL DEFAULT 0,
    "updatedListings" INTEGER NOT NULL DEFAULT 0,
    "duplicates" INTEGER NOT NULL DEFAULT 0,
    "errors" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScrapeJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScrapeLog" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "siteId" TEXT,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "details" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScrapeLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedSearch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "filters" JSONB NOT NULL,
    "naturalQuery" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastCheckedAt" TIMESTAMP(3),
    "matchCount" INTEGER NOT NULL DEFAULT 0,
    "newSinceCheck" INTEGER NOT NULL DEFAULT 0,
    "notifyEmail" BOOLEAN NOT NULL DEFAULT false,
    "notifyInApp" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedSearch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedSearchMatch" (
    "id" TEXT NOT NULL,
    "savedSearchId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "matchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seen" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SavedSearchMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "details" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "category" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ScrapeJobToSite" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_supabaseId_key" ON "User"("supabaseId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_supabaseId_idx" ON "User"("supabaseId");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Site_key_key" ON "Site"("key");

-- CreateIndex
CREATE INDEX "Site_key_idx" ON "Site"("key");

-- CreateIndex
CREATE INDEX "Site_enabled_idx" ON "Site"("enabled");

-- CreateIndex
CREATE INDEX "Site_deletedAt_idx" ON "Site"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Property_hash_key" ON "Property"("hash");

-- CreateIndex
CREATE INDEX "Property_hash_idx" ON "Property"("hash");

-- CreateIndex
CREATE INDEX "Property_siteId_idx" ON "Property"("siteId");

-- CreateIndex
CREATE INDEX "Property_status_idx" ON "Property"("status");

-- CreateIndex
CREATE INDEX "Property_listingType_idx" ON "Property"("listingType");

-- CreateIndex
CREATE INDEX "Property_category_idx" ON "Property"("category");

-- CreateIndex
CREATE INDEX "Property_state_area_idx" ON "Property"("state", "area");

-- CreateIndex
CREATE INDEX "Property_price_idx" ON "Property"("price");

-- CreateIndex
CREATE INDEX "Property_bedrooms_idx" ON "Property"("bedrooms");

-- CreateIndex
CREATE INDEX "Property_qualityScore_idx" ON "Property"("qualityScore");

-- CreateIndex
CREATE INDEX "Property_createdAt_idx" ON "Property"("createdAt");

-- CreateIndex
CREATE INDEX "Property_updatedAt_idx" ON "Property"("updatedAt");

-- CreateIndex
CREATE INDEX "Property_deletedAt_idx" ON "Property"("deletedAt");

-- CreateIndex
CREATE INDEX "Property_latitude_longitude_idx" ON "Property"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "Property_listingType_category_state_area_idx" ON "Property"("listingType", "category", "state", "area");

-- CreateIndex
CREATE INDEX "Property_listingType_price_idx" ON "Property"("listingType", "price");

-- CreateIndex
CREATE INDEX "Property_category_bedrooms_price_idx" ON "Property"("category", "bedrooms", "price");

-- CreateIndex
CREATE INDEX "Property_state_area_listingType_price_idx" ON "Property"("state", "area", "listingType", "price");

-- CreateIndex
CREATE INDEX "Property_listingType_category_status_idx" ON "Property"("listingType", "category", "status");

-- CreateIndex
CREATE INDEX "Property_isPremium_isFeatured_idx" ON "Property"("isPremium", "isFeatured");

-- CreateIndex
CREATE INDEX "PropertyVersion_propertyId_idx" ON "PropertyVersion"("propertyId");

-- CreateIndex
CREATE INDEX "PropertyVersion_propertyId_version_idx" ON "PropertyVersion"("propertyId", "version");

-- CreateIndex
CREATE INDEX "PropertyVersion_changeSource_idx" ON "PropertyVersion"("changeSource");

-- CreateIndex
CREATE INDEX "PropertyVersion_createdAt_idx" ON "PropertyVersion"("createdAt");

-- CreateIndex
CREATE INDEX "PriceHistory_propertyId_idx" ON "PriceHistory"("propertyId");

-- CreateIndex
CREATE INDEX "PriceHistory_propertyId_recordedAt_idx" ON "PriceHistory"("propertyId", "recordedAt");

-- CreateIndex
CREATE INDEX "ScrapeJob_status_idx" ON "ScrapeJob"("status");

-- CreateIndex
CREATE INDEX "ScrapeJob_type_idx" ON "ScrapeJob"("type");

-- CreateIndex
CREATE INDEX "ScrapeJob_createdAt_idx" ON "ScrapeJob"("createdAt");

-- CreateIndex
CREATE INDEX "ScrapeLog_jobId_idx" ON "ScrapeLog"("jobId");

-- CreateIndex
CREATE INDEX "ScrapeLog_siteId_idx" ON "ScrapeLog"("siteId");

-- CreateIndex
CREATE INDEX "ScrapeLog_level_idx" ON "ScrapeLog"("level");

-- CreateIndex
CREATE INDEX "ScrapeLog_timestamp_idx" ON "ScrapeLog"("timestamp");

-- CreateIndex
CREATE INDEX "SavedSearch_userId_idx" ON "SavedSearch"("userId");

-- CreateIndex
CREATE INDEX "SavedSearch_isActive_idx" ON "SavedSearch"("isActive");

-- CreateIndex
CREATE INDEX "SavedSearchMatch_savedSearchId_idx" ON "SavedSearchMatch"("savedSearchId");

-- CreateIndex
CREATE INDEX "SavedSearchMatch_propertyId_idx" ON "SavedSearchMatch"("propertyId");

-- CreateIndex
CREATE INDEX "SavedSearchMatch_matchedAt_idx" ON "SavedSearchMatch"("matchedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SavedSearchMatch_savedSearchId_propertyId_key" ON "SavedSearchMatch"("savedSearchId", "propertyId");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SystemSetting_key_key" ON "SystemSetting"("key");

-- CreateIndex
CREATE INDEX "SystemSetting_category_idx" ON "SystemSetting"("category");

-- CreateIndex
CREATE UNIQUE INDEX "_ScrapeJobToSite_AB_unique" ON "_ScrapeJobToSite"("A", "B");

-- CreateIndex
CREATE INDEX "_ScrapeJobToSite_B_index" ON "_ScrapeJobToSite"("B");

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyVersion" ADD CONSTRAINT "PropertyVersion_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyVersion" ADD CONSTRAINT "PropertyVersion_changedBy_fkey" FOREIGN KEY ("changedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScrapeJob" ADD CONSTRAINT "ScrapeJob_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScrapeLog" ADD CONSTRAINT "ScrapeLog_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ScrapeJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScrapeLog" ADD CONSTRAINT "ScrapeLog_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedSearch" ADD CONSTRAINT "SavedSearch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedSearchMatch" ADD CONSTRAINT "SavedSearchMatch_savedSearchId_fkey" FOREIGN KEY ("savedSearchId") REFERENCES "SavedSearch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedSearchMatch" ADD CONSTRAINT "SavedSearchMatch_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ScrapeJobToSite" ADD CONSTRAINT "_ScrapeJobToSite_A_fkey" FOREIGN KEY ("A") REFERENCES "ScrapeJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ScrapeJobToSite" ADD CONSTRAINT "_ScrapeJobToSite_B_fkey" FOREIGN KEY ("B") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
