-- Prompt 17: ConsumableItem catalog (division-scoped) + remove material-as-consumable flag.

CREATE TABLE "consumable_item" (
    "id" TEXT NOT NULL,
    "divisionId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "category" TEXT,
    "manufacturer" TEXT,
    "partNumber" TEXT,
    "unit" TEXT NOT NULL,
    "wasteFactorPct" DECIMAL(6,4) NOT NULL DEFAULT 0,
    "baseCost" DECIMAL(12,4),
    "isMarketRate" BOOLEAN NOT NULL DEFAULT false,
    "markupPct" DECIMAL(6,4) NOT NULL,
    "laborUnits" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "supplier" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consumable_item_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "consumable_item_divisionId_sku_key" ON "consumable_item"("divisionId", "sku");
CREATE INDEX "consumable_item_divisionId_idx" ON "consumable_item"("divisionId");

ALTER TABLE "consumable_item" ADD CONSTRAINT "consumable_item_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "division"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Materials pricing columns existed only for the isConsumable hack.
ALTER TABLE "material_item" DROP COLUMN "isConsumable",
DROP COLUMN "baseCost",
DROP COLUMN "markupPct",
DROP COLUMN "wasteFactorPct";
