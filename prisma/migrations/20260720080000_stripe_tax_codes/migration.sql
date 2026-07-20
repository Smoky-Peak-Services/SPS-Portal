-- CreateEnum
CREATE TYPE "WorkContext" AS ENUM ('INSTALL', 'SERVICE');

-- CreateTable
CREATE TABLE "stripe_tax_code" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "performanceLocationRequirement" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stripe_tax_code_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "labor_tax_code_default" (
    "id" TEXT NOT NULL,
    "taxProfile" "MaterialTaxProfile" NOT NULL,
    "workContext" "WorkContext" NOT NULL,
    "stripeTaxCodeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "labor_tax_code_default_pkey" PRIMARY KEY ("id")
);

-- AlterTable MaterialCategory
ALTER TABLE "material_category" ADD COLUMN "taxReviewed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "material_category" ADD COLUMN "stripeTaxCodeId" TEXT;
ALTER TABLE "material_category" ADD COLUMN "laborInstallTaxCodeId" TEXT;
ALTER TABLE "material_category" ADD COLUMN "laborServiceTaxCodeId" TEXT;

-- Drop free-text column (values discarded — re-select from seeded StripeTaxCode list)
ALTER TABLE "material_category" DROP COLUMN IF EXISTS "stripeTaxCode";
ALTER TABLE "material_category" ALTER COLUMN "taxProfile" SET DEFAULT 'REAL_PROPERTY';

-- AlterTable MaterialItem
ALTER TABLE "material_item" ADD COLUMN "stripeTaxCodeId" TEXT;
ALTER TABLE "material_item" ADD COLUMN "laborInstallTaxCodeId" TEXT;
ALTER TABLE "material_item" ADD COLUMN "laborServiceTaxCodeId" TEXT;
ALTER TABLE "material_item" DROP COLUMN IF EXISTS "stripeTaxCode";

-- CreateIndex
CREATE INDEX "material_category_taxReviewed_idx" ON "material_category"("taxReviewed");
CREATE UNIQUE INDEX "labor_tax_code_default_taxProfile_workContext_key" ON "labor_tax_code_default"("taxProfile", "workContext");

-- AddForeignKey
ALTER TABLE "labor_tax_code_default" ADD CONSTRAINT "labor_tax_code_default_stripeTaxCodeId_fkey" FOREIGN KEY ("stripeTaxCodeId") REFERENCES "stripe_tax_code"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "material_category" ADD CONSTRAINT "material_category_stripeTaxCodeId_fkey" FOREIGN KEY ("stripeTaxCodeId") REFERENCES "stripe_tax_code"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "material_category" ADD CONSTRAINT "material_category_laborInstallTaxCodeId_fkey" FOREIGN KEY ("laborInstallTaxCodeId") REFERENCES "stripe_tax_code"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "material_category" ADD CONSTRAINT "material_category_laborServiceTaxCodeId_fkey" FOREIGN KEY ("laborServiceTaxCodeId") REFERENCES "stripe_tax_code"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "material_item" ADD CONSTRAINT "material_item_stripeTaxCodeId_fkey" FOREIGN KEY ("stripeTaxCodeId") REFERENCES "stripe_tax_code"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "material_item" ADD CONSTRAINT "material_item_laborInstallTaxCodeId_fkey" FOREIGN KEY ("laborInstallTaxCodeId") REFERENCES "stripe_tax_code"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "material_item" ADD CONSTRAINT "material_item_laborServiceTaxCodeId_fkey" FOREIGN KEY ("laborServiceTaxCodeId") REFERENCES "stripe_tax_code"("id") ON DELETE SET NULL ON UPDATE CASCADE;
