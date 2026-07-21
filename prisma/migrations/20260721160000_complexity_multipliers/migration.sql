-- CreateEnum
CREATE TYPE "ComplexityCategory" AS ENUM ('STRUCTURAL', 'ACCESS', 'COMPLIANCE');

-- CreateTable
CREATE TABLE "complexity_multiplier" (
    "id" TEXT NOT NULL,
    "divisionId" TEXT NOT NULL,
    "segment" "Segment" NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" "ComplexityCategory" NOT NULL,
    "modificationRate" DECIMAL(5,4) NOT NULL,
    "description" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "complexity_multiplier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "complexity_multiplier_divisionId_idx" ON "complexity_multiplier"("divisionId");

-- CreateIndex
CREATE INDEX "complexity_multiplier_divisionId_segment_idx" ON "complexity_multiplier"("divisionId", "segment");

-- CreateIndex
CREATE UNIQUE INDEX "complexity_multiplier_divisionId_segment_slug_key" ON "complexity_multiplier"("divisionId", "segment", "slug");

-- AddForeignKey
ALTER TABLE "complexity_multiplier" ADD CONSTRAINT "complexity_multiplier_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "division"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
