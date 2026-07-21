/**
 * Canonical Cabin Services sheet literals (prompt 14 /
 * cabin-services-master-rate-sheet.xlsx, "Hourly Labor Rates").
 * Used by seed + unit tests — do not invent or round differently.
 *
 * Blend: Field Technician 70%, Senior Field Technician 20%, Inspector 10%.
 * Contractor Coordination is flat-billed independently from field labor
 * (never in the blend) — seeded as SERVICE context, allocation 0.
 * Discounted rates come straight from the sheet (0.90 multiplier column).
 */
import type {
  LaborMultipliersSeed,
  LaborPositionSeed,
} from "./labor-seed-types";

export const CABIN_LABOR_MULTIPLIERS: LaborMultipliersSeed = {
  burdenMultiplier: 1.85,
  standardBillingMultiplier: 1.4,
  afterHoursMultiplier: 1.45,
  holidayMultiplier: 1.75,
  discountedMultiplier: 0.9,
};

export const CABIN_LABOR_POSITIONS: LaborPositionSeed[] = [
  {
    title: "Field Technician",
    sku: "LAB-CBN-FLD-SPC",
    baseHourlyRate: 18.0,
    actualCostOfLabor: 33.3,
    standardBillingRate: 46.62,
    afterHoursRate: 67.599,
    holidayRate: 81.585,
    discountedRate: 41.958,
    quotedAllocationPct: 70.0,
    context: "INSTALL",
    sortOrder: 0,
  },
  {
    title: "Senior Field Technician",
    sku: "LAB-CBN-SFT-SPC",
    baseHourlyRate: 22.0,
    actualCostOfLabor: 40.7,
    standardBillingRate: 56.98,
    afterHoursRate: 82.621,
    holidayRate: 99.715,
    discountedRate: 51.282,
    quotedAllocationPct: 20.0,
    context: "INSTALL",
    sortOrder: 1,
  },
  {
    // Flat-billed independently from field labor — excluded from blend.
    title: "Contractor Coordination",
    sku: "LAB-CBN-CCO-SPC",
    baseHourlyRate: 35.0,
    actualCostOfLabor: 64.75,
    standardBillingRate: 90.65,
    afterHoursRate: 131.4425,
    holidayRate: 158.6375,
    discountedRate: 81.585,
    quotedAllocationPct: 0.0,
    context: "SERVICE",
    sortOrder: 2,
  },
  {
    title: "Inspector",
    sku: "LAB-CBN-INS-SPC",
    baseHourlyRate: 20.0,
    actualCostOfLabor: 37.0,
    standardBillingRate: 51.8,
    afterHoursRate: 75.11,
    holidayRate: 90.65,
    discountedRate: 46.62,
    quotedAllocationPct: 10.0,
    context: "INSTALL",
    sortOrder: 3,
  },
];
