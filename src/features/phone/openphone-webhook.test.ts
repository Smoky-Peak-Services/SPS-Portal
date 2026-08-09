import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isPrismaUniqueViolation } from "./match-target";
import {
  parseOccurredAt,
  resultFromWebhookError,
} from "./openphone-webhook-helpers";

describe("parseOccurredAt", () => {
  it("falls back to now for invalid dates", () => {
    const before = Date.now();
    const d = parseOccurredAt("not-a-date");
    const after = Date.now();
    assert.ok(d.getTime() >= before - 1000);
    assert.ok(d.getTime() <= after + 1000);
  });

  it("parses ISO strings", () => {
    const d = parseOccurredAt("2026-03-30T18:00:00.000Z");
    assert.equal(d.toISOString(), "2026-03-30T18:00:00.000Z");
  });
});

describe("resultFromWebhookError", () => {
  it("maps P2002 duplicate externalId to 200", () => {
    const err = Object.assign(new Error("Unique constraint"), {
      code: "P2002",
    });
    assert.equal(isPrismaUniqueViolation(err), true);
    const result = resultFromWebhookError(err);
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, { ok: true });
  });

  it("maps other errors to 500", () => {
    const result = resultFromWebhookError(new Error("boom"));
    assert.equal(result.status, 500);
    assert.deepEqual(result.body, { error: "processing failed" });
  });
});
