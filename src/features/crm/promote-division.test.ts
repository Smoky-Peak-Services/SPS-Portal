import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  customerTypeDivisionError,
  lockedDivisionSlugForCustomerType,
} from "./service-location";

describe("promote type × division", () => {
  it("rejects STR with Integrated Systems (never create that pair)", () => {
    const err = customerTypeDivisionError("STR", "integrated-systems");
    assert.ok(err);
    assert.match(err!, /Cabin Services/i);
    assert.equal(lockedDivisionSlugForCustomerType("STR"), "cabin-services");
  });

  it("rejects Commercial with Cabin Services", () => {
    const err = customerTypeDivisionError("COMMERCIAL", "cabin-services");
    assert.ok(err);
    assert.match(err!, /Integrated Systems/i);
  });

  it("allows Residential on either division", () => {
    assert.equal(
      customerTypeDivisionError("RESIDENTIAL", "integrated-systems"),
      null,
    );
    assert.equal(
      customerTypeDivisionError("RESIDENTIAL", "cabin-services"),
      null,
    );
  });
});
