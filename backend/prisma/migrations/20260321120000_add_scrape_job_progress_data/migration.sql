-- AlterTable
ALTER TABLE "ScrapeJob" ADD COLUMN IF NOT EXISTS "progressData" JSONB;
