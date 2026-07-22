-- Prompt 18: Equipment & Tools catalog (division-scoped).

CREATE TABLE "equipment_item" (
    "id" TEXT NOT NULL,
    "divisionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "unit" TEXT,
    "cost" DECIMAL(12,2) NOT NULL,
    "supplier" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_item_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "equipment_item_divisionId_name_key" ON "equipment_item"("divisionId", "name");
CREATE INDEX "equipment_item_divisionId_idx" ON "equipment_item"("divisionId");

ALTER TABLE "equipment_item" ADD CONSTRAINT "equipment_item_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "division"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
