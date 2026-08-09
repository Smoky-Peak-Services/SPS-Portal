import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { smaTierOverlapError } from "./sma-overlap";

describe("smaTierOverlapError", () => {
  const existing = [
    {
      id: "1",
      sku: "TR1",
      systemValueMin: 500,
      systemValueMax: 5000,
    },
    {
      id: "2",
      sku: "TR2",
      systemValueMin: 5000,
      systemValueMax: 10000,
    },
  ];

  it("allows touching edges (prev.max === next.min)", () => {
    assert.equal(
      smaTierOverlapError(
        {
          sku: "TR3",
          systemValueMin: 10000,
          systemValueMax: 18000,
        },
        existing,
      ),
      null,
    );
  });

  it("rejects overlapping ranges", () => {
    const err = smaTierOverlapError(
      {
        sku: "BAD",
        systemValueMin: 4000,
        systemValueMax: 6000,
      },
      existing,
    );
    assert.ok(err);
    assert.match(err!, /overlap/i);
  });
});
