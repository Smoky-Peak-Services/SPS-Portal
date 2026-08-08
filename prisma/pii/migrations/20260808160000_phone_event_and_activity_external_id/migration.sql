-- CreateEnum
CREATE TYPE "PhoneEventKind" AS ENUM ('CALL', 'MISSED_CALL', 'VOICEMAIL', 'SMS');

-- AlterTable
ALTER TABLE "activity" ADD COLUMN "externalId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "activity_externalId_key" ON "activity"("externalId");

-- CreateTable
CREATE TABLE "phone_event" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "kind" "PhoneEventKind" NOT NULL,
    "direction" TEXT NOT NULL,
    "fromE164" TEXT,
    "toE164" TEXT,
    "partyNat" TEXT,
    "body" TEXT,
    "recordingUrl" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "phone_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "phone_event_externalId_key" ON "phone_event"("externalId");

-- CreateIndex
CREATE INDEX "phone_event_occurredAt_idx" ON "phone_event"("occurredAt");

-- CreateIndex
CREATE INDEX "phone_event_partyNat_idx" ON "phone_event"("partyNat");
