import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildSummaryLine,
  buildTranscriptLine,
  callKindAndLineBeta,
  resolveBetaParties,
  resolveLegacyParties,
} from "./openphone-payload";

describe("resolveLegacyParties", () => {
  it("prefers participants over Quo user id in from", () => {
    assert.deepEqual(
      resolveLegacyParties("incoming", {
        from: "US3000104572",
        to: "+18655550001",
        participants: ["+18655551234"],
      }),
      { externalRaw: "+18655551234", workspaceRaw: "+18655550001" },
    );
  });

  it("uses validated from/to when participants absent", () => {
    assert.deepEqual(
      resolveLegacyParties("outgoing", {
        from: "+18655550001",
        to: "+18655559999",
      }),
      { externalRaw: "+18655559999", workspaceRaw: "+18655550001" },
    );
  });
});

describe("resolveBetaParties", () => {
  it("reads external and workspace from context.participants", () => {
    assert.deepEqual(
      resolveBetaParties({
        participants: {
          workspace: ["+18655550001"],
          external: ["+18655550002"],
        },
      }),
      { externalRaw: "+18655550002", workspaceRaw: "+18655550001" },
    );
  });

  it("falls back to senderIdentifier for messages", () => {
    assert.deepEqual(
      resolveBetaParties({
        senderIdentifier: "+18655551234",
        recipientIdentifiers: ["+18655550001"],
      }),
      { externalRaw: "+18655551234", workspaceRaw: "+18655550001" },
    );
  });
});

describe("callKindAndLineBeta", () => {
  it("marks ai-handled as missed with AI line", () => {
    const r = callKindAndLineBeta({ status: "ai-handled" });
    assert.equal(r.kind, "MISSED_CALL");
    assert.match(r.line, /AI answered/);
  });

  it("marks answered calls", () => {
    const r = callKindAndLineBeta({ status: "answered" });
    assert.equal(r.kind, "CALL");
    assert.equal(r.line, "Inbound call — answered");
  });
});

describe("buildSummaryLine", () => {
  it("joins summary and next steps", () => {
    assert.equal(
      buildSummaryLine(
        ["Customer asked for pricing."],
        ["Send follow-up email."],
      ),
      "Summary: Customer asked for pricing. | Next: Send follow-up email.",
    );
  });
});

describe("buildTranscriptLine", () => {
  it("prefixes transcript text", () => {
    assert.equal(
      buildTranscriptLine([{ content: "Hello" }, { content: "there" }]),
      "Transcript: Hello there",
    );
  });
});
