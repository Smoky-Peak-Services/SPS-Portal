import { z } from "zod";

const optionalNullableMoney = z.preprocess(
  (v) => {
    if (v === undefined) return undefined;
    if (v === null || v === "") return null;
    return v;
  },
  z.union([z.null(), z.coerce.number().nonnegative()]).optional(),
);

const optionalNullableString = z.preprocess(
  (v) => {
    if (v === undefined) return undefined;
    if (v === null) return null;
    const s = String(v).trim();
    return s === "" ? null : s;
  },
  z.union([z.null(), z.string().max(240)]).optional(),
);

const consumableFields = {
  description: z.string().trim().min(1).max(240),
  sku: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[A-Za-z0-9._-]+$/, "SKU must be alphanumeric (._- allowed)"),
  category: optionalNullableString,
  manufacturer: optionalNullableString,
  partNumber: optionalNullableString,
  unit: z.string().trim().min(1).max(80),
  wasteFactorPct: z.coerce.number().min(0).max(10),
  baseCost: optionalNullableMoney,
  isMarketRate: z.coerce.boolean(),
  markupPct: z.coerce.number().min(0).max(10),
  laborUnits: z.coerce.number().min(0),
  supplier: optionalNullableString,
  notes: optionalNullableString,
  isActive: z.coerce.boolean(),
  sortOrder: z.coerce.number().int(),
};

export const createConsumableSchema = z
  .object({
    divisionId: z.string().min(1),
    ...consumableFields,
  })
  .superRefine((row, ctx) => {
    if (
      !row.isMarketRate &&
      (row.baseCost === null || row.baseCost === undefined)
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Base cost is required unless the item is market rate",
        path: ["baseCost"],
      });
    }
  });

export const updateConsumableSchema = z
  .object({
    id: z.string().min(1),
    ...consumableFields,
  })
  .superRefine((row, ctx) => {
    if (
      !row.isMarketRate &&
      (row.baseCost === null || row.baseCost === undefined)
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Base cost is required unless the item is market rate",
        path: ["baseCost"],
      });
    }
  });

export const deleteConsumableSchema = z.object({
  id: z.string().min(1),
});

/** Sell price from base × (1 + markup). Null for market-rate rows. */
export function sellPriceFrom(
  baseCost: number | null,
  markupPct: number,
  isMarketRate: boolean,
): number | null {
  if (isMarketRate || baseCost == null) return null;
  return Math.round(baseCost * (1 + markupPct) * 100) / 100;
}

export const DEFAULT_MARKUP_BY_DIVISION_SLUG: Record<string, number> = {
  "integrated-systems": 0.5,
  "cabin-services": 0.3,
};
