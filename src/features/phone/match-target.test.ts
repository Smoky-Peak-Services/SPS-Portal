import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  activityTypeForPhoneKind,
  mergeBody,
} from "./match-target";

describe("activityTypeForPhoneKind", () => {
  it("maps SMS to SMS and call kinds to CALL", () => {
    assert.equal(activityTypeForPhoneKind("SMS"), "SMS");
    assert.equal(activityTypeForPhoneKind("CALL"), "CALL");
    assert.equal(activityTypeForPhoneKind("MISSED_CALL"), "CALL");
    assert.equal(activityTypeForPhoneKind("VOICEMAIL"), "CALL");
  });
});

describe("mergeBody", () => {
  it("appends unique lines", () => {
    assert.equal(mergeBody(null, "Missed call"), "Missed call");
    assert.equal(
      mergeBody("Missed call", "Summary: hi"),
      "Missed call\nSummary: hi",
    );
    assert.equal(
      mergeBody("Missed call", "Missed call"),
      "Missed call",
    );
  });
});
