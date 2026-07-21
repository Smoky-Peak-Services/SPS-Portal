/**
 * Shared shapes for per-scope labor rate literals (prompt 14).
 * One literals file per scope: is-com-rates.ts, is-res-rates.ts, cabin-rates.ts.
 */
import type { WorkContext } from "@prisma/client";

export type LaborMultipliersSeed = {
  burdenMultiplier: number;
  standardBillingMultiplier: number;
  afterHoursMultiplier: number;
  holidayMultiplier: number;
  /** Cabin Services only (0.90) — null for scopes without a discounted rate. */
  discountedMultiplier: number | null;
};

export type LaborPositionSeed = {
  title: string;
  sku: string;
  baseHourlyRate: number;
  actualCostOfLabor: number;
  standardBillingRate: number;
  afterHoursRate: number;
  holidayRate: number;
  /** Sheet column present only on Cabin Services. */
  discountedRate: number | null;
  quotedAllocationPct: number;
  context: WorkContext;
  sortOrder: number;
};

export type LaborScopeSeed = {
  divisionSlug: string;
  segment: "COMMERCIAL" | "RESIDENTIAL" | "STR";
  multipliers: LaborMultipliersSeed;
  positions: LaborPositionSeed[];
};
