-- Prompt 14: per-scope pricing model correction.
-- Part 1: MaterialAttribute becomes per-scope (backfill existing rows to IS-Commercial).
-- Part 2: LaborRateConfig rename + discounted multiplier/rate columns.
-- Part 3: ComplexityMultiplier generalization (string category, type, appliedTo, value).
-- Part 4: ServicePlanRate (Cabin bedroom-count plans).

-- ---------- Part 1: attributes per-scope ----------

ALTER TABLE "material_attribute" ADD COLUMN "divisionId" TEXT;
ALTER TABLE "material_attribute" ADD COLUMN "segment" "Segment";

-- Backfill: everything imported so far was Integrated Systems Commercial.
UPDATE "material_attribute"
SET "divisionId" = (SELECT "id" FROM "division" WHERE "slug" = 'integrated-systems'),
    "segment"    = 'COMMERCIAL';

ALTER TABLE "material_attribute" ALTER COLUMN "divisionId" SET NOT NULL;
ALTER TABLE "material_attribute" ALTER COLUMN "segment" SET NOT NULL;

DROP INDEX "material_attribute_slug_key";

CREATE UNIQUE INDEX "material_attribute_divisionId_segment_slug_key"
  ON "material_attribute"("divisionId", "segment", "slug");
CREATE INDEX "material_attribute_divisionId_idx" ON "material_attribute"("divisionId");
CREATE INDEX "material_attribute_divisionId_segment_idx" ON "material_attribute"("divisionId", "segment");

ALTER TABLE "material_attribute"
  ADD CONSTRAINT "material_attribute_divisionId_fkey"
  FOREIGN KEY ("divisionId") REFERENCES "division"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------- Part 2: labor rates ----------

ALTER TABLE "labor_rate_config" RENAME COLUMN "commercialBillingMultiplier" TO "standardBillingMultiplier";
ALTER TABLE "labor_rate_config" ADD COLUMN "discountedMultiplier" DECIMAL(6,4);

ALTER TABLE "labor_position" ADD COLUMN "discountedRate" DECIMAL(12,2);

-- ---------- Part 3: complexity generalization ----------

CREATE TYPE "ComplexityMultiplierType" AS ENUM ('PERCENT', 'FIXED');
CREATE TYPE "ComplexityAppliedTo" AS ENUM ('TOTAL_LABOR', 'PROGRAMMING_LABOR', 'NETWORK_LABOR', 'BASE_PACKAGE_RATE');

-- category: 3-value enum -> free text (per-scope sheet vocabulary).
ALTER TABLE "complexity_multiplier"
  ALTER COLUMN "category" TYPE TEXT USING initcap("category"::text);
DROP TYPE "ComplexityCategory";

ALTER TABLE "complexity_multiplier"
  ADD COLUMN "multiplierType" "ComplexityMultiplierType" NOT NULL DEFAULT 'PERCENT';
ALTER TABLE "complexity_multiplier"
  ADD COLUMN "appliedTo" "ComplexityAppliedTo" NOT NULL DEFAULT 'TOTAL_LABOR';

-- modificationRate -> value, widened so it can hold fixed dollar amounts (75.00).
ALTER TABLE "complexity_multiplier" RENAME COLUMN "modificationRate" TO "value";
ALTER TABLE "complexity_multiplier" ALTER COLUMN "value" TYPE DECIMAL(12,4);

-- ---------- Part 4: Cabin service plans ----------

CREATE TYPE "ServicePlanType" AS ENUM ('MAINTENANCE', 'INSPECTION', 'FULL_SERVICE');

CREATE TABLE "service_plan_rate" (
    "id" TEXT NOT NULL,
    "divisionId" TEXT NOT NULL,
    "segment" "Segment" NOT NULL,
    "planType" "ServicePlanType" NOT NULL,
    "sku" TEXT NOT NULL,
    "bedrooms" INTEGER,
    "maxBathrooms" INTEGER,
    "rate" DECIMAL(12,2),
    "isCustomQuote" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_plan_rate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "service_plan_rate_divisionId_idx" ON "service_plan_rate"("divisionId");
CREATE INDEX "service_plan_rate_divisionId_segment_planType_idx" ON "service_plan_rate"("divisionId", "segment", "planType");
CREATE UNIQUE INDEX "service_plan_rate_divisionId_segment_sku_key" ON "service_plan_rate"("divisionId", "segment", "sku");

ALTER TABLE "service_plan_rate"
  ADD CONSTRAINT "service_plan_rate_divisionId_fkey"
  FOREIGN KEY ("divisionId") REFERENCES "division"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
