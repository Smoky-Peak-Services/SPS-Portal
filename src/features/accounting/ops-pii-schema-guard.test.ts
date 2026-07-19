import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Guards the ops/PII boundary: ops schema must not grow customer address/email/phone columns.
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
  it("ops schema has no PII identity columns on Job/Ticket", () => {
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

    assert.match(schema, /customerId\s+String\?/);
    assert.match(schema, /propertyId\s+String\?/);
  });

  it("pii schema owns Customer and Lead", () => {
    const schema = readFileSync(
      join(process.cwd(), "prisma", "pii", "schema.prisma"),
      "utf8",
    );
    assert.match(schema, /model Customer \{/);
    assert.match(schema, /model Lead \{/);
    assert.match(schema, /model ServiceLocation \{/);
    assert.match(schema, /model IngestKey \{/);
  });
});
