/**
 * Canonical IS-Commercial sheet literals (prompt 09 / is-com-hourly-labor-rates.csv).
 * Used by seed + unit tests — do not invent or round differently.
 */
import type { WorkContext } from "@prisma/client";

export const IS_COM_LABOR_MULTIPLIERS = {
  burdenMultiplier: 1.85,
  commercialBillingMultiplier: 1.89,
  afterHoursMultiplier: 1.45,
  holidayMultiplier: 1.75,
} as const;

export type IsComLaborPositionSeed = {
  title: string;
  sku: string;
  baseHourlyRate: number;
  actualCostOfLabor: number;
  standardBillingRate: number;
  afterHoursRate: number;
  holidayRate: number;
  quotedAllocationPct: number;
  context: WorkContext;
  sortOrder: number;
};

export const IS_COM_LABOR_POSITIONS: IsComLaborPositionSeed[] = [
  {
    title: "Tech 1 and 2",
    sku: "LAB-COM-T12-SIS",
    baseHourlyRate: 18.0,
    actualCostOfLabor: 33.3,
    standardBillingRate: 62.94,
    afterHoursRate: 91.26,
    holidayRate: 110.14,
    quotedAllocationPct: 50.0,
    context: "INSTALL",
    sortOrder: 0,
  },
  {
    title: "Senior Technician",
    sku: "LAB-COM-SRT-SIS",
    baseHourlyRate: 26.0,
    actualCostOfLabor: 48.1,
    standardBillingRate: 90.91,
    afterHoursRate: 131.82,
    holidayRate: 159.09,
    quotedAllocationPct: 20.0,
    context: "INSTALL",
    sortOrder: 1,
  },
  {
    title: "Programmer",
    sku: "LAB-COM-PRG-SIS",
    baseHourlyRate: 32.0,
    actualCostOfLabor: 59.2,
    standardBillingRate: 111.89,
    afterHoursRate: 162.24,
    holidayRate: 195.8,
    quotedAllocationPct: 15.0,
    context: "INSTALL",
    sortOrder: 2,
  },
  {
    title: "Project Manager",
    sku: "LAB-COM-PMG-SIS",
    baseHourlyRate: 43.0,
    actualCostOfLabor: 79.55,
    standardBillingRate: 150.35,
    afterHoursRate: 218.01,
    holidayRate: 263.11,
    quotedAllocationPct: 15.0,
    context: "INSTALL",
    sortOrder: 3,
  },
  {
    title: "Service Technician",
    sku: "LAB-COM-SVC-SIS",
    baseHourlyRate: 22.0,
    actualCostOfLabor: 40.7,
    standardBillingRate: 76.92,
    afterHoursRate: 111.54,
    holidayRate: 134.62,
    quotedAllocationPct: 0.0,
    context: "SERVICE",
    sortOrder: 4,
  },
];

export const SERVICE_TECH_SKU = "LAB-COM-SVC-SIS";
