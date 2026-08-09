import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Guards the ops/PII boundary: ops schema must not grow customer
 * address/email/phone columns. Auth-owned User / Invitation identity fields
 * are explicitly allowlisted. PII schema owns lead ingest + CRM identity.
 */

/** Field names matching these patterns on String columns are forbidden in ops. */
const PII_FIELD_PATTERN =
  /^\s*(\w*(?:email|phone|line1|line2|postal|address|displayName)\w*)\s+String/i;

/**
 * Auth models may keep staff/invite identity strings. Keyed as `Model.field`.
 */
const OPS_PII_ALLOWLIST = new Set([
  "User.email",
  "User.name",
  "User.phone",
  "Invitation.email",
  // Better Auth session metadata — not customer identity.
  "Session.ipAddress",
]);

function forbiddenOpsPiiFields(schema: string): string[] {
  const hits: string[] = [];
  let currentModel: string | null = null;

  for (const line of schema.split(/\r?\n/)) {
    const modelMatch = /^\s*model\s+(\w+)\s*\{/.exec(line);
    if (modelMatch) {
      currentModel = modelMatch[1] ?? null;
      continue;
    }
    if (/^\s*\}/.test(line)) {
      currentModel = null;
      continue;
    }
    if (!currentModel) continue;

    const fieldMatch = PII_FIELD_PATTERN.exec(line);
    if (!fieldMatch) continue;

    const field = fieldMatch[1]!;
    const key = `${currentModel}.${field}`;
    if (!OPS_PII_ALLOWLIST.has(key)) {
      hits.push(key);
    }
  }

  return hits;
}

describe("ops-pii schema guard", () => {
  it("ops schema has no PII identity columns (pattern denylist)", () => {
    const schema = readFileSync(
      join(process.cwd(), "prisma", "schema.prisma"),
      "utf8",
    );

    const hits = forbiddenOpsPiiFields(schema);
    assert.deepEqual(
      hits,
      [],
      `ops schema must not contain PII identity fields: ${hits.join(", ")}`,
    );
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
    assert.match(schema, /model ConsumableItem \{/);
    assert.match(schema, /model EquipmentItem \{/);
    assert.match(schema, /enum RecurringFeeType \{/);
    assert.equal(schema.includes("isConsumable"), false);
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

  it("pii schema owns lead ingest and CRM identity models", () => {
    const schema = readFileSync(
      join(process.cwd(), "prisma", "pii", "schema.prisma"),
      "utf8",
    );
    assert.match(schema, /model Division \{/);
    assert.match(schema, /model Lead \{/);
    assert.match(schema, /model Activity \{/);
    assert.match(schema, /model IngestKey \{/);
    assert.match(schema, /model Customer \{/);
    assert.match(schema, /model Contact \{/);
    assert.match(schema, /model ServiceLocation \{/);
    assert.match(schema, /model BillingProfile \{/);
    assert.match(schema, /model PhoneEvent \{/);
    assert.match(schema, /enum PhoneEventKind \{/);
    assert.match(schema, /externalId/);
    assert.match(schema, /enum ServiceLine \{/);
    assert.equal(schema.includes("model Job {"), false);
    assert.equal(schema.includes("model Ticket {"), false);
  });

  it("ops schema has no CRM identity models", () => {
    const schema = readFileSync(
      join(process.cwd(), "prisma", "schema.prisma"),
      "utf8",
    );
    assert.equal(schema.includes("model Customer {"), false);
    assert.equal(schema.includes("model Contact {"), false);
    assert.equal(schema.includes("model ServiceLocation {"), false);
    assert.equal(schema.includes("model BillingProfile {"), false);
  });
});
