import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildAssignmentExportAoa,
  parseAssignmentAoa,
  planAssignmentImport,
  type ExistingAssignmentSnapshot,
} from "./attribute-assignment-io";

function snapshot(): ExistingAssignmentSnapshot {
  return {
    categories: [
      {
        id: "c1",
        name: "Card Reader",
        slug: "card-reader",
        domainName: "Access Control",
        domainSlug: "access-control",
      },
    ],
    attributes: [
      {
        id: "a1",
        name: "Color",
        slug: "color",
        options: [
          { id: "o1", label: "Black" },
          { id: "o2", label: "White" },
        ],
      },
      {
        id: "a2",
        name: "Finish",
        slug: "finish",
        options: [{ id: "o3", label: "Matte" }],
      },
    ],
    assignments: [
      {
        id: "as1",
        categoryId: "c1",
        attributeId: "a1",
        isRequired: false,
        isFilterable: true,
        isVariantDefining: false,
        defaultOptionId: "o1",
        defaultOptionLabel: "Black",
        sortOrder: 0,
      },
    ],
  };
}

describe("planAssignmentImport", () => {
  it("updates flags and creates missing assignments", () => {
    const aoa = buildAssignmentExportAoa([
      {
        domain: "Access Control",
        category: "Card Reader",
        attribute: "color",
        isRequired: true,
        isFilterable: false,
        isVariantDefining: false,
        defaultOption: "White",
        sortOrder: 2,
      },
      {
        domain: "Access Control",
        category: "Card Reader",
        attribute: "finish",
        isRequired: false,
        isFilterable: true,
        isVariantDefining: false,
        defaultOption: null,
        sortOrder: 1,
      },
    ]);
    const parsed = parseAssignmentAoa(aoa);
    const plan = planAssignmentImport(snapshot(), parsed);
    assert.equal(plan.creates.length, 1);
    assert.equal(plan.creates[0]!.attributeId, "a2");
    assert.equal(plan.updates.length, 1);
    assert.equal(plan.updates[0]!.isRequired, true);
    assert.equal(plan.updates[0]!.isFilterable, false);
    assert.equal(plan.updates[0]!.defaultOptionId, "o2");
    assert.equal(plan.updates[0]!.sortOrder, 2);
  });

  it("never deletes missing assignments; unresolved reported", () => {
    const parsed = parseAssignmentAoa([
      [...["domain", "category", "attribute", "isRequired", "isFilterable", "isVariantDefining", "defaultOption", "sortOrder"]],
      ["Ghost", "Cat", "color", "true", "true", "false", "", "0"],
    ]);
    const plan = planAssignmentImport(snapshot(), parsed);
    assert.equal(plan.creates.length, 0);
    assert.equal(plan.updates.length, 0);
    assert.equal(plan.unresolved.length, 1);
    // existing assignment not in file — untouched
    assert.equal(snapshot().assignments.length, 1);
  });

  it("invalid defaultOption flagged and left unchanged", () => {
    const parsed = parseAssignmentAoa([
      [
        "domain",
        "category",
        "attribute",
        "isRequired",
        "isFilterable",
        "isVariantDefining",
        "defaultOption",
        "sortOrder",
      ],
      [
        "Access Control",
        "Card Reader",
        "color",
        "false",
        "true",
        "false",
        "Neon Pink",
        "0",
      ],
    ]);
    const plan = planAssignmentImport(snapshot(), parsed);
    assert.ok(
      plan.warnings.some((w) => /Unknown defaultOption/.test(w.message)),
    );
    assert.equal(plan.updates.length, 0);
    assert.equal(plan.unchangedCount, 1);
  });
});
