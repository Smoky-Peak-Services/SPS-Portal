import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Guards the ops/PII boundary: ops schema must not grow customer address/email/phone columns.
 * PII schema owns lead ingest only until CRM is rebuilt.
 */
const FORBIDDEN_OPS_FIELDS = [
  "displayName",
  "generalEmail",
  "mainPhone",
  "hqLine1",
  "billingEmail",
  "billingPhone",
  "billingLine1",
  "directEmail",
  "directPhone",
];

describe("ops-pii schema guard", () => {
  it("ops schema has no PII identity columns", () => {
    const schema = readFileSync(
      join(process.cwd(), "prisma", "schema.prisma"),
      "utf8",
    );

    for (const field of FORBIDDEN_OPS_FIELDS) {
      assert.equal(
        schema.includes(`${field} `) ||
          schema.includes(`${field}\n`) ||
          schema.includes(`${field}\t`),
        false,
        `ops schema must not contain PII field "${field}"`,
      );
    }
  });

  it("ops schema is auth + org + materials + pricing (no Field Ops Job/Ticket)", () => {
    const schema = readFileSync(
      join(process.cwd(), "prisma", "schema.prisma"),
      "utf8",
    );
    assert.match(schema, /model User \{/);
    assert.match(schema, /model Division \{/);
    assert.match(schema, /model Invitation \{/);
    assert.match(schema, /model MaterialItem \{/);
    assert.match(schema, /model MaterialDomain \{/);
    assert.match(schema, /model StripeTaxCode \{/);
    assert.match(schema, /model LaborTaxCodeDefault \{/);
    assert.match(schema, /model LaborRateConfig \{/);
    assert.match(schema, /model LaborPosition \{/);
    assert.match(schema, /enum LaborRateType \{/);
    assert.match(schema, /model ComplexityMultiplier \{/);
    assert.match(schema, /enum ComplexityMultiplierType \{/);
    assert.match(schema, /enum ComplexityAppliedTo \{/);
    assert.match(schema, /model ServicePlanRate \{/);
    assert.match(schema, /enum ServicePlanType \{/);
    assert.match(schema, /model RecurringFeeItem \{/);
    assert.match(schema, /enum RecurringFeeType \{/);
    assert.match(schema, /enum BillingCycle \{/);
    assert.match(schema, /enum RateValueType \{/);
    assert.match(schema, /model Capability \{/);
    assert.match(schema, /model RoleCapability \{/);
    assert.match(schema, /model UserCapabilityOverride \{/);
    assert.match(schema, /enum WorkContext \{/);
    assert.match(schema, /power_user/);
    assert.match(schema, /field_tech/);
    assert.match(schema, /accounting/);
    assert.match(schema, /field_supervisor/);
    assert.equal(schema.includes("model Job {"), false);
    assert.equal(schema.includes("model Ticket {"), false);
    assert.equal(schema.includes("model TimeEntry {"), false);
    // Prompt 14 removed the IS-Commercial-only shapes.
    assert.equal(schema.includes("enum ComplexityCategory {"), false);
    assert.equal(schema.includes("commercialBillingMultiplier"), false);
  });

  it("pii schema owns lead ingest models and not deferred CRM", () => {
    const schema = readFileSync(
      join(process.cwd(), "prisma", "pii", "schema.prisma"),
      "utf8",
    );
    assert.match(schema, /model Division \{/);
    assert.match(schema, /model Lead \{/);
    assert.match(schema, /model Activity \{/);
    assert.match(schema, /model IngestKey \{/);
    assert.equal(schema.includes("model Customer {"), false);
    assert.equal(schema.includes("model Contact {"), false);
    assert.equal(schema.includes("model ServiceLocation {"), false);
  });
});
