/**
 * Shared shape for per-scope complexity multiplier literals (prompt 14).
 * `category` is the sheet's free-text vocabulary (per-scope, not an enum).
 * PERCENT `value` is a decimal rate (0.08 = 8%); FIXED `value` is dollars.
 */
import type {
  ComplexityAppliedTo,
  ComplexityMultiplierType,
} from "@prisma/client";

export type ComplexitySeed = {
  name: string;
  slug: string;
  category: string;
  multiplierType: ComplexityMultiplierType;
  appliedTo: ComplexityAppliedTo;
  value: number;
  description: string;
  sortOrder: number;
};
