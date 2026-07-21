-- Expand Role enum: staff→power_user, field→field_tech; add accounting + field_supervisor.
-- Capability RBAC tables.

CREATE TYPE "Role_new" AS ENUM (
  'admin',
  'power_user',
  'sales',
  'accounting',
  'field_supervisor',
  'field_tech'
);

ALTER TABLE "user" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "invitation" ALTER COLUMN "role" DROP DEFAULT;

ALTER TABLE "user"
  ALTER COLUMN "role" TYPE "Role_new"
  USING (
    CASE "role"::text
      WHEN 'staff' THEN 'power_user'::"Role_new"
      WHEN 'field' THEN 'field_tech'::"Role_new"
      WHEN 'admin' THEN 'admin'::"Role_new"
      WHEN 'sales' THEN 'sales'::"Role_new"
      ELSE 'power_user'::"Role_new"
    END
  );

ALTER TABLE "invitation"
  ALTER COLUMN "role" TYPE "Role_new"
  USING (
    CASE "role"::text
      WHEN 'staff' THEN 'power_user'::"Role_new"
      WHEN 'field' THEN 'field_tech'::"Role_new"
      WHEN 'admin' THEN 'admin'::"Role_new"
      WHEN 'sales' THEN 'sales'::"Role_new"
      ELSE 'field_tech'::"Role_new"
    END
  );

DROP TYPE "Role";
ALTER TYPE "Role_new" RENAME TO "Role";

ALTER TABLE "user" ALTER COLUMN "role" SET DEFAULT 'power_user'::"Role";
ALTER TABLE "invitation" ALTER COLUMN "role" SET DEFAULT 'field_tech'::"Role";

CREATE TYPE "CapabilityEffect" AS ENUM ('ALLOW', 'DENY');

CREATE TABLE "capability" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "capability_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "role_capability" (
    "id" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "capabilityId" TEXT NOT NULL,
    "allowed" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "role_capability_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_capability_override" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "capabilityId" TEXT NOT NULL,
    "effect" "CapabilityEffect" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_capability_override_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "role_capability_role_capabilityId_key" ON "role_capability"("role", "capabilityId");
CREATE INDEX "role_capability_capabilityId_idx" ON "role_capability"("capabilityId");
CREATE UNIQUE INDEX "user_capability_override_userId_capabilityId_key" ON "user_capability_override"("userId", "capabilityId");
CREATE INDEX "user_capability_override_capabilityId_idx" ON "user_capability_override"("capabilityId");

ALTER TABLE "role_capability" ADD CONSTRAINT "role_capability_capabilityId_fkey" FOREIGN KEY ("capabilityId") REFERENCES "capability"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_capability_override" ADD CONSTRAINT "user_capability_override_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_capability_override" ADD CONSTRAINT "user_capability_override_capabilityId_fkey" FOREIGN KEY ("capabilityId") REFERENCES "capability"("id") ON DELETE CASCADE ON UPDATE CASCADE;
