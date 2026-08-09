-- Prompt 25: tax FK Restrict, DISCOUNTED enum, indexes, partial uniques,
-- scope-pair enforcement (trigger — Postgres CHECK cannot use subqueries).

-- LaborRateType.DISCOUNTED
ALTER TYPE "LaborRateType" ADD VALUE IF NOT EXISTS 'DISCOUNTED';

-- Session / Account FK indexes
CREATE INDEX IF NOT EXISTS "session_userId_idx" ON "session"("userId");
CREATE INDEX IF NOT EXISTS "account_userId_idx" ON "account"("userId");
CREATE INDEX IF NOT EXISTS "labor_tax_code_default_stripeTaxCodeId_idx"
  ON "labor_tax_code_default"("stripeTaxCodeId");

-- Six material tax FKs: SET NULL → RESTRICT
ALTER TABLE "material_category" DROP CONSTRAINT IF EXISTS "material_category_stripeTaxCodeId_fkey";
ALTER TABLE "material_category" DROP CONSTRAINT IF EXISTS "material_category_laborInstallTaxCodeId_fkey";
ALTER TABLE "material_category" DROP CONSTRAINT IF EXISTS "material_category_laborServiceTaxCodeId_fkey";
ALTER TABLE "material_item" DROP CONSTRAINT IF EXISTS "material_item_stripeTaxCodeId_fkey";
ALTER TABLE "material_item" DROP CONSTRAINT IF EXISTS "material_item_laborInstallTaxCodeId_fkey";
ALTER TABLE "material_item" DROP CONSTRAINT IF EXISTS "material_item_laborServiceTaxCodeId_fkey";

ALTER TABLE "material_category" ADD CONSTRAINT "material_category_stripeTaxCodeId_fkey"
  FOREIGN KEY ("stripeTaxCodeId") REFERENCES "stripe_tax_code"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "material_category" ADD CONSTRAINT "material_category_laborInstallTaxCodeId_fkey"
  FOREIGN KEY ("laborInstallTaxCodeId") REFERENCES "stripe_tax_code"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "material_category" ADD CONSTRAINT "material_category_laborServiceTaxCodeId_fkey"
  FOREIGN KEY ("laborServiceTaxCodeId") REFERENCES "stripe_tax_code"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "material_item" ADD CONSTRAINT "material_item_stripeTaxCodeId_fkey"
  FOREIGN KEY ("stripeTaxCodeId") REFERENCES "stripe_tax_code"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "material_item" ADD CONSTRAINT "material_item_laborInstallTaxCodeId_fkey"
  FOREIGN KEY ("laborInstallTaxCodeId") REFERENCES "stripe_tax_code"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "material_item" ADD CONSTRAINT "material_item_laborServiceTaxCodeId_fkey"
  FOREIGN KEY ("laborServiceTaxCodeId") REFERENCES "stripe_tax_code"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- One SMA_SVM row per scope
CREATE UNIQUE INDEX IF NOT EXISTS "recurring_fee_item_one_svm_per_scope_key"
  ON "recurring_fee_item"("divisionId", "segment")
  WHERE "feeType" = 'SMA_SVM';

-- One bedroom tier per plan type (standard rows only)
CREATE UNIQUE INDEX IF NOT EXISTS "service_plan_rate_tier_key"
  ON "service_plan_rate"("divisionId", "segment", "planType", "bedrooms")
  WHERE "bedrooms" IS NOT NULL;

-- One pending invitation per email
CREATE UNIQUE INDEX IF NOT EXISTS "invitation_pending_email_key"
  ON "invitation"("email")
  WHERE "acceptedAt" IS NULL;

-- Valid (division, segment) pairs — triggers (CHECK cannot subquery Division.slug)
CREATE OR REPLACE FUNCTION enforce_valid_scope_pair()
RETURNS trigger AS $$
DECLARE
  div_slug text;
BEGIN
  SELECT slug INTO div_slug FROM "division" WHERE id = NEW."divisionId";
  IF div_slug IS NULL THEN
    RAISE EXCEPTION 'Unknown divisionId %', NEW."divisionId";
  END IF;
  IF div_slug = 'cabin-services' AND NEW.segment = 'STR' THEN
    RETURN NEW;
  END IF;
  IF div_slug = 'integrated-systems' AND NEW.segment IN ('COMMERCIAL', 'RESIDENTIAL') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Invalid scope pair: division slug=% segment=%', div_slug, NEW.segment;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'material_domain',
    'material_attribute',
    'labor_rate_config',
    'labor_position',
    'complexity_multiplier',
    'recurring_fee_item',
    'service_plan_rate'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', t || '_valid_scope', t);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT OR UPDATE OF "divisionId", segment ON %I
       FOR EACH ROW EXECUTE FUNCTION enforce_valid_scope_pair()',
      t || '_valid_scope',
      t
    );
  END LOOP;
END $$;
