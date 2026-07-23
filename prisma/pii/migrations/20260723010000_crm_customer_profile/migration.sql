-- CRM Customer Profile: Customer → BillingProfile → Contact → ServiceLocation

CREATE TYPE "CustomerType" AS ENUM ('RESIDENTIAL', 'COMMERCIAL', 'STR');
CREATE TYPE "ContactRoleTag" AS ENUM ('CLIENT', 'PROPERTY_MANAGER', 'ESTIMATOR', 'TENANT');
CREATE TYPE "BillingProfileType" AS ENUM ('INDIVIDUAL', 'ENTITY');
CREATE TYPE "TaxExemptEntityType" AS ENUM ('GOVERNMENT', 'CHURCH', 'SCHOOL', 'OTHER');
CREATE TYPE "SmaStatus" AS ENUM ('ACTIVE_PAYG', 'ACTIVE_TERM', 'INACTIVE');
CREATE TYPE "ServiceLocationClassification" AS ENUM ('RESIDENTIAL', 'COMMERCIAL');
CREATE TYPE "ServiceLine" AS ENUM ('INTEGRATED_SYSTEMS', 'CABIN_SERVICES');

CREATE TABLE "customer" (
    "id" TEXT NOT NULL,
    "type" "CustomerType" NOT NULL,
    "displayName" TEXT NOT NULL,
    "generalEmail" TEXT,
    "mainPhone" TEXT,
    "website" TEXT,
    "hqLine1" TEXT,
    "hqLine2" TEXT,
    "hqCity" TEXT,
    "hqRegion" TEXT,
    "hqPostal" TEXT,
    "hqLat" DOUBLE PRECISION,
    "hqLng" DOUBLE PRECISION,
    "divisionId" TEXT NOT NULL,
    "source" TEXT,
    "notes" TEXT,
    "summary" TEXT,
    "archivedAt" TIMESTAMP(3),
    "stripeCustomerId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "customer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "billing_profile" (
    "id" TEXT NOT NULL,
    "rootOrgId" TEXT NOT NULL,
    "profileType" "BillingProfileType" NOT NULL DEFAULT 'INDIVIDUAL',
    "billingName" TEXT,
    "billingEmail" TEXT,
    "billingPhone" TEXT,
    "billingLine1" TEXT,
    "billingLine2" TEXT,
    "billingCity" TEXT,
    "billingRegion" TEXT,
    "billingPostal" TEXT,
    "billingLat" DOUBLE PRECISION,
    "billingLng" DOUBLE PRECISION,
    "pointOfContactId" TEXT,
    "taxExemptionNumber" TEXT,
    "taxExemptEntityType" "TaxExemptEntityType",
    "taxExemptCertOnFile" BOOLEAN NOT NULL DEFAULT false,
    "smaStatus" "SmaStatus",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "billing_profile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contact" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "directEmail" TEXT,
    "directPhone" TEXT,
    "roleTag" "ContactRoleTag",
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isBilling" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "contact_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "service_location" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "siteName" TEXT,
    "classification" "ServiceLocationClassification" NOT NULL DEFAULT 'RESIDENTIAL',
    "serviceLines" "ServiceLine"[] DEFAULT ARRAY['INTEGRATED_SYSTEMS']::"ServiceLine"[],
    "line1" TEXT NOT NULL,
    "line2" TEXT,
    "city" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'US',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "notes" TEXT,
    "bedrooms" INTEGER,
    "bathrooms" INTEGER,
    "complexitySelections" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "service_location_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "billing_profile_rootOrgId_key" ON "billing_profile"("rootOrgId");
CREATE INDEX "customer_displayName_idx" ON "customer"("displayName");
CREATE INDEX "customer_divisionId_idx" ON "customer"("divisionId");
CREATE INDEX "customer_archivedAt_idx" ON "customer"("archivedAt");
CREATE INDEX "billing_profile_rootOrgId_idx" ON "billing_profile"("rootOrgId");
CREATE INDEX "contact_customerId_idx" ON "contact"("customerId");
CREATE INDEX "service_location_customerId_idx" ON "service_location"("customerId");

ALTER TABLE "customer"
    ADD CONSTRAINT "customer_divisionId_fkey"
    FOREIGN KEY ("divisionId") REFERENCES "division"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "billing_profile"
    ADD CONSTRAINT "billing_profile_rootOrgId_fkey"
    FOREIGN KEY ("rootOrgId") REFERENCES "customer"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "contact"
    ADD CONSTRAINT "contact_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "customer"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "service_location"
    ADD CONSTRAINT "service_location_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "customer"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "lead" ADD COLUMN IF NOT EXISTS "customerId" TEXT;
CREATE INDEX IF NOT EXISTS "lead_customerId_idx" ON "lead"("customerId");
ALTER TABLE "lead"
    ADD CONSTRAINT "lead_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "customer"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "activity" ADD COLUMN IF NOT EXISTS "customerId" TEXT;
ALTER TABLE "activity" ADD COLUMN IF NOT EXISTS "contactId" TEXT;
ALTER TABLE "activity" ADD COLUMN IF NOT EXISTS "serviceLocationId" TEXT;
CREATE INDEX IF NOT EXISTS "activity_customerId_idx" ON "activity"("customerId");
CREATE INDEX IF NOT EXISTS "activity_contactId_idx" ON "activity"("contactId");
CREATE INDEX IF NOT EXISTS "activity_serviceLocationId_idx" ON "activity"("serviceLocationId");

ALTER TABLE "activity"
    ADD CONSTRAINT "activity_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "customer"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "activity"
    ADD CONSTRAINT "activity_contactId_fkey"
    FOREIGN KEY ("contactId") REFERENCES "contact"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "activity"
    ADD CONSTRAINT "activity_serviceLocationId_fkey"
    FOREIGN KEY ("serviceLocationId") REFERENCES "service_location"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
