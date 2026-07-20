-- CreateEnum
CREATE TYPE "Segment" AS ENUM ('COMMERCIAL', 'RESIDENTIAL', 'STR');

-- CreateEnum
CREATE TYPE "MaterialAttributeInputType" AS ENUM ('SELECT', 'MULTISELECT', 'TEXT', 'NUMBER', 'BOOLEAN');

-- CreateEnum
CREATE TYPE "MaterialTaxProfile" AS ENUM ('REAL_PROPERTY', 'TPP');

-- CreateTable
CREATE TABLE "material_unit" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_domain" (
    "id" TEXT NOT NULL,
    "divisionId" TEXT NOT NULL,
    "segment" "Segment" NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_domain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_category" (
    "id" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "requiresManualPartNumber" BOOLEAN NOT NULL DEFAULT false,
    "taxProfile" "MaterialTaxProfile" NOT NULL DEFAULT 'TPP',
    "stripeTaxCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_attribute" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "inputType" "MaterialAttributeInputType" NOT NULL,
    "unit" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_attribute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_attribute_option" (
    "id" TEXT NOT NULL,
    "attributeId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_attribute_option_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_attribute_assignment" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "attributeId" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "isFilterable" BOOLEAN NOT NULL DEFAULT true,
    "isVariantDefining" BOOLEAN NOT NULL DEFAULT false,
    "defaultOptionId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_attribute_assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_item" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "laborUnits" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "laborUnitNotes" TEXT,
    "isConsumable" BOOLEAN NOT NULL DEFAULT false,
    "baseCost" DECIMAL(12,2),
    "markupPct" DECIMAL(6,4),
    "wasteFactorPct" DECIMAL(6,4),
    "supplier" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "taxProfile" "MaterialTaxProfile",
    "stripeTaxCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_item_attribute_value" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "attributeId" TEXT NOT NULL,
    "optionId" TEXT,
    "valueText" TEXT,
    "valueNumber" DECIMAL(18,6),
    "valueBool" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_item_attribute_value_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "material_unit_code_key" ON "material_unit"("code");

-- CreateIndex
CREATE INDEX "material_domain_divisionId_idx" ON "material_domain"("divisionId");

-- CreateIndex
CREATE UNIQUE INDEX "material_domain_divisionId_segment_slug_key" ON "material_domain"("divisionId", "segment", "slug");

-- CreateIndex
CREATE INDEX "material_category_domainId_idx" ON "material_category"("domainId");

-- CreateIndex
CREATE UNIQUE INDEX "material_category_domainId_slug_key" ON "material_category"("domainId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "material_attribute_slug_key" ON "material_attribute"("slug");

-- CreateIndex
CREATE INDEX "material_attribute_option_attributeId_idx" ON "material_attribute_option"("attributeId");

-- CreateIndex
CREATE UNIQUE INDEX "material_attribute_option_attributeId_value_key" ON "material_attribute_option"("attributeId", "value");

-- CreateIndex
CREATE INDEX "material_attribute_assignment_categoryId_idx" ON "material_attribute_assignment"("categoryId");

-- CreateIndex
CREATE INDEX "material_attribute_assignment_attributeId_idx" ON "material_attribute_assignment"("attributeId");

-- CreateIndex
CREATE UNIQUE INDEX "material_attribute_assignment_categoryId_attributeId_key" ON "material_attribute_assignment"("categoryId", "attributeId");

-- CreateIndex
CREATE INDEX "material_item_categoryId_idx" ON "material_item"("categoryId");

-- CreateIndex
CREATE INDEX "material_item_unitId_idx" ON "material_item"("unitId");

-- CreateIndex
CREATE INDEX "material_item_attribute_value_itemId_idx" ON "material_item_attribute_value"("itemId");

-- CreateIndex
CREATE INDEX "material_item_attribute_value_attributeId_idx" ON "material_item_attribute_value"("attributeId");

-- CreateIndex
CREATE UNIQUE INDEX "material_item_attribute_value_itemId_attributeId_key" ON "material_item_attribute_value"("itemId", "attributeId");

-- AddForeignKey
ALTER TABLE "material_domain" ADD CONSTRAINT "material_domain_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "division"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_category" ADD CONSTRAINT "material_category_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "material_domain"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_attribute_option" ADD CONSTRAINT "material_attribute_option_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "material_attribute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_attribute_assignment" ADD CONSTRAINT "material_attribute_assignment_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "material_category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_attribute_assignment" ADD CONSTRAINT "material_attribute_assignment_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "material_attribute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_attribute_assignment" ADD CONSTRAINT "material_attribute_assignment_defaultOptionId_fkey" FOREIGN KEY ("defaultOptionId") REFERENCES "material_attribute_option"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_item" ADD CONSTRAINT "material_item_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "material_category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_item" ADD CONSTRAINT "material_item_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "material_unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_item_attribute_value" ADD CONSTRAINT "material_item_attribute_value_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "material_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_item_attribute_value" ADD CONSTRAINT "material_item_attribute_value_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "material_attribute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_item_attribute_value" ADD CONSTRAINT "material_item_attribute_value_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "material_attribute_option"("id") ON DELETE SET NULL ON UPDATE CASCADE;
