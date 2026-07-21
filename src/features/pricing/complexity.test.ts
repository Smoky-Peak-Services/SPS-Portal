import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculateAdjustedLaborHours,
  type ActiveComplexityMultiplier,
} from "./adjusted-hours";
import { calculateAdjustedPackageRate } from "./package-rate";
import { CABIN_COMPLEXITY_MULTIPLIERS } from "./cabin-complexity";
import { IS_COM_COMPLEXITY_MULTIPLIERS } from "./is-com-complexity";
import { IS_RES_COMPLEXITY_MULTIPLIERS } from "./is-res-complexity";
import { IS_COM_LABOR_POSITIONS } from "./is-com-rates";
import { distributeQuotedLabor } from "./quoted-labor";

function toActive(m: {
  name: string;
  slug: string;
  multiplierType: "PERCENT" | "FIXED";
  appliedTo: ActiveComplexityMultiplier["appliedTo"];
  value: number;
}): ActiveComplexityMultiplier {
  return {
    name: m.name,
    slug: m.slug,
    multiplierType: m.multiplierType,
    appliedTo: m.appliedTo,
    value: m.value,
  };
}

const comBySlug = Object.fromEntries(
  IS_COM_COMPLEXITY_MULTIPLIERS.map((m) => [m.slug, m]),
);
const resBySlug = Object.fromEntries(
  IS_RES_COMPLEXITY_MULTIPLIERS.map((m) => [m.slug, m]),
);
const cabinBySlug = Object.fromEntries(
  CABIN_COMPLEXITY_MULTIPLIERS.map((m) => [m.slug, m]),
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

describe("seed literals shape", () => {
  it("IS-Com 10 / IS-Res 16 / Cabin 20 rows", () => {
    assert.equal(IS_COM_COMPLEXITY_MULTIPLIERS.length, 10);
    assert.equal(IS_RES_COMPLEXITY_MULTIPLIERS.length, 16);
    assert.equal(CABIN_COMPLEXITY_MULTIPLIERS.length, 20);
  });

  it("stores percent values as decimals (0.08 not 8)", () => {
    const occupied = comBySlug["occupied-building-restrictions"]!;
    assert.equal(occupied.value, 0.08);
    for (const m of [
      ...IS_COM_COMPLEXITY_MULTIPLIERS,
      ...IS_RES_COMPLEXITY_MULTIPLIERS,
      ...CABIN_COMPLEXITY_MULTIPLIERS,
    ]) {
      if (m.multiplierType === "PERCENT") {
        assert.ok(m.value < 1, `${m.slug} percent value should be a decimal`);
      }
    }
  });

  it("IS-Com and IS-Res are all labor buckets; Cabin is all BASE_PACKAGE_RATE", () => {
    for (const m of [
      ...IS_COM_COMPLEXITY_MULTIPLIERS,
      ...IS_RES_COMPLEXITY_MULTIPLIERS,
    ]) {
      assert.notEqual(m.appliedTo, "BASE_PACKAGE_RATE", m.slug);
      assert.equal(m.multiplierType, "PERCENT", m.slug);
    }
    for (const m of CABIN_COMPLEXITY_MULTIPLIERS) {
      assert.equal(m.appliedTo, "BASE_PACKAGE_RATE", m.slug);
    }
  });
});

describe("calculateAdjustedLaborHours", () => {
  it("14h + Occupied Building (0.08) → 15.12h", () => {
    const occupied = comBySlug["occupied-building-restrictions"]!;
    const result = calculateAdjustedLaborHours({ totalHours: 14 }, [
      toActive(occupied),
    ]);
    assert.equal(result.perMultiplier[0]!.additionalHours, 1.12);
    assert.equal(result.additionalHours, 1.12);
    assert.equal(result.totalHours, 15.12);
  });

  it("14h + Confined (0.12) + Prevailing (0.18) → 18.20h additive (not 18.50 compounded)", () => {
    const confined = comBySlug["confined-space-access"]!;
    const prevailing = comBySlug["prevailing-wage-requirements"]!;
    const result = calculateAdjustedLaborHours({ totalHours: 14 }, [
      toActive(confined),
      toActive(prevailing),
    ]);
    assert.equal(result.perMultiplier[0]!.additionalHours, 1.68);
    assert.equal(result.perMultiplier[1]!.additionalHours, 2.52);
    assert.equal(result.additionalHours, 4.2);
    assert.equal(result.totalHours, 18.2);
    // Compounded would be 14 × 1.12 × 1.18 = 18.4984 ≈ 18.50 — must NOT match
    assert.notEqual(result.totalHours, 18.5);
  });

  it("IS-Res programming bucket: 0.20 applies to programmingHours only", () => {
    const programming =
      resBySlug["advanced-automation-programming-and-scene-logic"]!;
    const integration = resBySlug["smart-home-system-integration-complexity"]!;
    assert.equal(programming.appliedTo, "PROGRAMMING_LABOR");
    const result = calculateAdjustedLaborHours(
      { totalHours: 100, programmingHours: 20 },
      [toActive(programming), toActive(integration)],
    );
    // 20 programming hours × 0.20 = 4; 100 total × 0.18 = 18
    assert.equal(result.perMultiplier[0]!.baseHours, 20);
    assert.equal(result.perMultiplier[0]!.additionalHours, 4);
    assert.equal(result.perMultiplier[1]!.additionalHours, 18);
    assert.equal(result.totalHours, 122);
  });

  it("bucket falls back to totalHours when not itemized", () => {
    const network = resBySlug["residential-network-infrastructure-complexity"]!;
    assert.equal(network.appliedTo, "NETWORK_LABOR");
    const result = calculateAdjustedLaborHours({ totalHours: 40 }, [
      toActive(network),
    ]);
    assert.equal(result.perMultiplier[0]!.baseHours, 40);
    assert.equal(result.perMultiplier[0]!.additionalHours, 6);
    assert.equal(result.totalHours, 46);
  });

  it("rejects FIXED and BASE_PACKAGE_RATE rows (Cabin rows are not hours adders)", () => {
    const adu = cabinBySlug["adu-dwelling"]!;
    assert.throws(
      () => calculateAdjustedLaborHours({ totalHours: 10 }, [toActive(adu)]),
      /FIXED|BASE_PACKAGE_RATE/,
    );
    const vaulted = cabinBySlug["vaulted-ceilings"]!;
    assert.throws(
      () =>
        calculateAdjustedLaborHours({ totalHours: 10 }, [toActive(vaulted)]),
      /BASE_PACKAGE_RATE/,
    );
  });

  it("chains into distributeQuotedLabor on adjusted hours", () => {
    const confined = comBySlug["confined-space-access"]!;
    const prevailing = comBySlug["prevailing-wage-requirements"]!;
    const { totalHours } = calculateAdjustedLaborHours({ totalHours: 14 }, [
      toActive(confined),
      toActive(prevailing),
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

describe("calculateAdjustedPackageRate", () => {
  it("Cabin $150 base + ADU ($75 FIXED) + Vaulted (2.5% PERCENT) → $228.75", () => {
    const adu = cabinBySlug["adu-dwelling"]!;
    const vaulted = cabinBySlug["vaulted-ceilings"]!;
    const result = calculateAdjustedPackageRate(150, [
      toActive(adu),
      toActive(vaulted),
    ]);
    assert.equal(result.perMultiplier[0]!.additionalAmount, 75);
    assert.equal(result.perMultiplier[1]!.additionalAmount, 3.75);
    assert.equal(result.additionalAmount, 78.75);
    assert.equal(result.totalRate, 228.75);
  });

  it("additive, not compounded", () => {
    const gas = cabinBySlug["gas-fireplace"]!; // 0.04
    const smart = cabinBySlug["smart-home-integrations"]!; // 0.08
    const result = calculateAdjustedPackageRate(200, [
      toActive(gas),
      toActive(smart),
    ]);
    // 200 × 0.04 + 200 × 0.08 = 24, not 200 × 1.04 × 1.08 - 200 = 24.64
    assert.equal(result.additionalAmount, 24);
    assert.equal(result.totalRate, 224);
  });

  it("rejects labor-bucket rows", () => {
    const occupied = comBySlug["occupied-building-restrictions"]!;
    assert.throws(
      () => calculateAdjustedPackageRate(150, [toActive(occupied)]),
      /TOTAL_LABOR/,
    );
  });
});
