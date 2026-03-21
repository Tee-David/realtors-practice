-- Add Site Intelligence fields
ALTER TABLE "Site" ADD COLUMN "learnStatus" TEXT NOT NULL DEFAULT 'NOT_LEARNED';
ALTER TABLE "Site" ADD COLUMN "learnedAt" TIMESTAMP(3);
ALTER TABLE "Site" ADD COLUMN "learnJobId" TEXT;
ALTER TABLE "Site" ADD COLUMN "siteProfile" JSONB;

-- Add LEARN_SITE to ScrapeJobType enum
ALTER TYPE "ScrapeJobType" ADD VALUE IF NOT EXISTS 'LEARN_SITE';

-- Add index on learnStatus
CREATE INDEX "Site_learnStatus_idx" ON "Site"("learnStatus");
