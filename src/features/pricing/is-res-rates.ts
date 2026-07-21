/**
 * Canonical IS-Residential sheet literals (prompt 14 /
 * is-residential-master-rate-sheet.xlsx, "Residential Hourly Labor Rates").
 * Used by seed + unit tests — do not invent or round differently.
 * Blend: Tech 1/2 60%, Senior Technician 25%, Programmer 15%.
 */
import type {
  LaborMultipliersSeed,
  LaborPositionSeed,
} from "./labor-seed-types";

export const IS_RES_LABOR_MULTIPLIERS: LaborMultipliersSeed = {
  burdenMultiplier: 1.85,
  standardBillingMultiplier: 1.4,
  afterHoursMultiplier: 1.45,
  holidayMultiplier: 1.75,
  discountedMultiplier: null,
};

export const IS_RES_LABOR_POSITIONS: LaborPositionSeed[] = [
  {
    title: "Tech 1 / 2",
    sku: "LAB-RES-T12-SIS",
    baseHourlyRate: 18.0,
    actualCostOfLabor: 33.3,
    standardBillingRate: 46.62,
    afterHoursRate: 67.599,
    holidayRate: 81.585,
    discountedRate: null,
    quotedAllocationPct: 60.0,
    context: "INSTALL",
    sortOrder: 0,
  },
  {
    title: "Senior Technician",
    sku: "LAB-RES-SRT-SIS",
    baseHourlyRate: 26.0,
    actualCostOfLabor: 48.1,
    standardBillingRate: 67.34,
    afterHoursRate: 97.643,
    holidayRate: 117.845,
    discountedRate: null,
    quotedAllocationPct: 25.0,
    context: "INSTALL",
    sortOrder: 1,
  },
  {
    title: "Programmer",
    sku: "LAB-RES-PRG-SIS",
    baseHourlyRate: 32.0,
    actualCostOfLabor: 59.2,
    standardBillingRate: 82.88,
    afterHoursRate: 120.176,
    holidayRate: 145.04,
    discountedRate: null,
    quotedAllocationPct: 15.0,
    context: "INSTALL",
    sortOrder: 2,
  },
  {
    // Service billing only — never in the project labor mix.
    title: "Service Technician",
    sku: "LAB-RES-SVC-SIS",
    baseHourlyRate: 22.0,
    actualCostOfLabor: 40.7,
    standardBillingRate: 56.98,
    afterHoursRate: 82.621,
    holidayRate: 99.715,
    discountedRate: null,
    quotedAllocationPct: 0.0,
    context: "SERVICE",
    sortOrder: 3,
  },
];
