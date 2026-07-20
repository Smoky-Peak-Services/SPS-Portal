import type { MaterialTaxProfile } from "@prisma/client";

export type TaxClassification = {
  taxProfile: MaterialTaxProfile | null;
  stripeTaxCode: string | null;
  inheritedFrom: "item" | "category" | null;
};

/** Resolve tax metadata: item override → category default → null (never invent a code). */
export function resolveItemTaxClassification(
  item: {
    taxProfile: MaterialTaxProfile | null;
    stripeTaxCode: string | null;
  },
  category: {
    taxProfile: MaterialTaxProfile;
    stripeTaxCode: string | null;
  },
): TaxClassification {
  const taxProfile = item.taxProfile ?? category.taxProfile ?? null;
  const stripeTaxCode =
    (item.stripeTaxCode?.trim() || null) ??
    (category.stripeTaxCode?.trim() || null);

  let inheritedFrom: TaxClassification["inheritedFrom"] = null;
  if (item.taxProfile != null || (item.stripeTaxCode?.trim() ?? "") !== "") {
    inheritedFrom = "item";
  } else if (taxProfile != null || stripeTaxCode != null) {
    inheritedFrom = "category";
  }

  return { taxProfile, stripeTaxCode, inheritedFrom };
}
