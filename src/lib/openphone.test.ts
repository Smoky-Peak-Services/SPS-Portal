import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";
import {
  decodeWhsecKey,
  verifyLegacyOpenPhoneSignature,
  verifyQuoWhsecSignature,
} from "./openphone";

describe("decodeWhsecKey", () => {
  it("decodes whsec_ prefix", () => {
    const raw = Buffer.from("test-signing-key-bytes!!");
    const secret = `whsec_${raw.toString("base64")}`;
    assert.deepEqual(decodeWhsecKey(secret), raw);
  });

  it("returns null for non-whsec secrets", () => {
    assert.equal(decodeWhsecKey("notasecret"), null);
  });
});

describe("verifyQuoWhsecSignature", () => {
  it("accepts a valid v1 signature", () => {
    const keyBytes = Buffer.from("unit-test-quo-webhook-key");
    const secret = `whsec_${keyBytes.toString("base64")}`;
    const webhookId = "msg_test_1";
    const webhookTimestamp = String(Math.floor(Date.now() / 1000));
    const rawBody = JSON.stringify({ type: "message.received", data: {} });
    const signed = `${webhookId}.${webhookTimestamp}.${rawBody}`;
    const sig = createHmac("sha256", keyBytes)
      .update(signed, "utf8")
      .digest("base64");

    assert.equal(
      verifyQuoWhsecSignature(
        rawBody,
        webhookId,
        webhookTimestamp,
        `v1,${sig}`,
        [secret],
      ),
      true,
    );
  });

  it("rejects bad signature", () => {
    const keyBytes = Buffer.from("unit-test-quo-webhook-key");
    const secret = `whsec_${keyBytes.toString("base64")}`;
    assert.equal(
      verifyQuoWhsecSignature(
        "{}",
        "msg_1",
        String(Math.floor(Date.now() / 1000)),
        "v1,AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
        [secret],
      ),
      false,
    );
  });
});

describe("verifyLegacyOpenPhoneSignature", () => {
  it("accepts hmac;1;ts;sig", () => {
    const keyBytes = Buffer.from("legacy-key-material-bytes");
    const secret = keyBytes.toString("base64");
    const timestamp = "1710000000";
    const rawBody = '{"type":"call.completed"}';
    const signed = `${timestamp}.${rawBody}`;
    const sig = createHmac("sha256", keyBytes)
      .update(signed, "utf8")
      .digest("base64");
    const header = `hmac;1;${timestamp};${sig}`;

    assert.equal(
      verifyLegacyOpenPhoneSignature(rawBody, header, [secret]),
      true,
    );
  });
});
