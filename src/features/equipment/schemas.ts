import { z } from "zod";

/**
 * Hard-baked pass-through markup for use-time pricing on quotes/tickets —
 * not stored on the catalog item, not editable (prompt 18).
 */
export const EQUIPMENT_MARKUP = 1.15;

/** Sell = round(cost × 1.15) when cost is entered on a quote/ticket. e.g. 475 → 546.25 */
export function sellPriceFromCost(cost: number): number {
  return Math.round(cost * EQUIPMENT_MARKUP * 100) / 100;
}

const optionalNullableString = z.preprocess(
  (v) => {
    if (v === undefined) return undefined;
    if (v === null) return null;
    const s = String(v).trim();
    return s === "" ? null : s;
  },
  z.union([z.null(), z.string().max(240)]).optional(),
);

const optionalSku = z.preprocess(
  (v) => {
    if (v === undefined) return undefined;
    if (v === null || v === "") return null;
    return String(v).trim();
  },
  z
    .union([
      z.null(),
      z
        .string()
        .max(64)
        .regex(/^[A-Za-z0-9._-]+$/, "SKU must be alphanumeric (._- allowed)"),
    ])
    .optional(),
);

const equipmentFields = {
  name: z.string().trim().min(1).max(240),
  sku: optionalSku,
  unit: optionalNullableString,
  supplier: optionalNullableString,
  notes: optionalNullableString,
  isActive: z.coerce.boolean(),
  sortOrder: z.coerce.number().int(),
};

export const createEquipmentSchema = z.object({
  divisionId: z.string().min(1),
  ...equipmentFields,
});

export const updateEquipmentSchema = z.object({
  id: z.string().min(1),
  ...equipmentFields,
});

export const deleteEquipmentSchema = z.object({
  id: z.string().min(1),
});
