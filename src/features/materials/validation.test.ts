import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertItemAttributeValues } from "./validation";

describe("assertItemAttributeValues", () => {
  const assignments = [
    {
      id: "asg1",
      categoryId: "cat1",
      attributeId: "attr1",
      isRequired: true,
      isFilterable: true,
      isVariantDefining: false,
      defaultOptionId: null,
      sortOrder: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      attribute: {
        id: "attr1",
        inputType: "SELECT" as const,
        slug: "finish",
        options: [
          { id: "opt1", value: "brass", isActive: true },
          { id: "opt2", value: "chrome", isActive: true },
        ],
      },
    },
  ];

  it("rejects unassigned attribute ids", () => {
    assert.throws(
      () =>
        assertItemAttributeValues({
          assignments,
          values: [{ attributeId: "other", optionId: "opt1" }],
        }),
      /not assigned/,
    );
  });

  it("rejects missing required values", () => {
    assert.throws(
      () => assertItemAttributeValues({ assignments, values: [] }),
      /Required attribute/,
    );
  });

  it("accepts a valid required select value", () => {
    assert.doesNotThrow(() =>
      assertItemAttributeValues({
        assignments,
        values: [{ attributeId: "attr1", optionId: "opt1" }],
      }),
    );
  });
});
