import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculateAdjustedLaborHours } from "./adjusted-hours";
import { IS_COM_COMPLEXITY_MULTIPLIERS } from "./is-com-complexity";
import { IS_COM_LABOR_POSITIONS } from "./is-com-rates";
import { distributeQuotedLabor } from "./quoted-labor";

const bySlug = Object.fromEntries(
  IS_COM_COMPLEXITY_MULTIPLIERS.map((m) => [m.slug, m]),
);

const installPositions = IS_COM_LABOR_POSITIONS.filter(
  (p) => p.context === "INSTALL",
).map((p) => ({
  sku: p.sku,
  title: p.title,
  context: p.context as "INSTALL",
  quotedAllocationPct: p.quotedAllocationPct,
  standardBillingRate: p.standardBillingRate,
  afterHoursRate: p.afterHoursRate,
  holidayRate: p.holidayRate,
  actualCostOfLabor: p.actualCostOfLabor,
}));

describe("calculateAdjustedLaborHours", () => {
  it("stores/reads modificationRate as decimal (0.08 not 8)", () => {
    const occupied = bySlug["occupied-building-restrictions"]!;
    assert.equal(occupied.modificationRate, 0.08);
    assert.ok(occupied.modificationRate < 1);
  });

  it("14h + Occupied Building (0.08) → 15.12h", () => {
    const occupied = bySlug["occupied-building-restrictions"]!;
    const result = calculateAdjustedLaborHours(14, [
      {
        name: occupied.name,
        slug: occupied.slug,
        modificationRate: occupied.modificationRate,
      },
    ]);
    assert.equal(result.perMultiplier[0]!.additionalHours, 1.12);
    assert.equal(result.additionalHours, 1.12);
    assert.equal(result.totalHours, 15.12);
  });

  it("14h + Confined (0.12) + Prevailing (0.18) → 18.20h additive (not 18.50 compounded)", () => {
    const confined = bySlug["confined-space-access"]!;
    const prevailing = bySlug["prevailing-wage-requirements"]!;
    const result = calculateAdjustedLaborHours(14, [
      {
        name: confined.name,
        slug: confined.slug,
        modificationRate: confined.modificationRate,
      },
      {
        name: prevailing.name,
        slug: prevailing.slug,
        modificationRate: prevailing.modificationRate,
      },
    ]);
    assert.equal(result.perMultiplier[0]!.additionalHours, 1.68);
    assert.equal(result.perMultiplier[1]!.additionalHours, 2.52);
    assert.equal(result.additionalHours, 4.2);
    assert.equal(result.totalHours, 18.2);
    // Compounded would be 14 × 1.12 × 1.18 = 18.4984 ≈ 18.50 — must NOT match
    assert.notEqual(result.totalHours, 18.5);
  });

  it("chains into distributeQuotedLabor on adjusted hours", () => {
    const confined = bySlug["confined-space-access"]!;
    const prevailing = bySlug["prevailing-wage-requirements"]!;
    const { totalHours } = calculateAdjustedLaborHours(14, [
      {
        name: confined.name,
        slug: confined.slug,
        modificationRate: confined.modificationRate,
      },
      {
        name: prevailing.name,
        slug: prevailing.slug,
        modificationRate: prevailing.modificationRate,
      },
    ]);
    assert.equal(totalHours, 18.2);
    const labor = distributeQuotedLabor(
      totalHours,
      installPositions,
      "STANDARD",
    );
    assert.equal(labor.totalHours, 18.2);
    assert.ok(labor.billable > 0);
  });
});
