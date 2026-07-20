import type { MaterialTaxProfile, WorkContext } from "@prisma/client";

/**
 * Material / labor tax classification helpers.
 * Per Ryan's classification (informed by SES v. Roberts) —
 * see claude/prompts/05-materials-tax-code-linkage.md
 * Never invent a Stripe tax code — leave null if nothing resolves.
 */

export type TaxClassification = {
  taxProfile: MaterialTaxProfile | null;
  stripeTaxCodeId: string | null;
  inheritedFrom: "item" | "category" | null;
};

export type LaborTaxDefaults = {
  taxProfile: MaterialTaxProfile;
  workContext: WorkContext;
  stripeTaxCodeId: string;
}[];

type TaxableItem = {
  taxProfile: MaterialTaxProfile | null;
  stripeTaxCodeId: string | null;
  laborInstallTaxCodeId?: string | null;
  laborServiceTaxCodeId?: string | null;
};

type TaxableCategory = {
  taxProfile: MaterialTaxProfile;
  stripeTaxCodeId: string | null;
  laborInstallTaxCodeId?: string | null;
  laborServiceTaxCodeId?: string | null;
};

/** Resolve material tax metadata: item override → category default → null. */
export function resolveItemTaxClassification(
  item: TaxableItem,
  category: TaxableCategory,
): TaxClassification {
  const taxProfile = item.taxProfile ?? category.taxProfile ?? null;
  const stripeTaxCodeId =
    item.stripeTaxCodeId?.trim() ||
    category.stripeTaxCodeId?.trim() ||
    null;

  let inheritedFrom: TaxClassification["inheritedFrom"] = null;
  if (
    item.taxProfile != null ||
    (item.stripeTaxCodeId?.trim() ?? "") !== ""
  ) {
    inheritedFrom = "item";
  } else if (taxProfile != null || stripeTaxCodeId != null) {
    inheritedFrom = "category";
  }

  return { taxProfile, stripeTaxCodeId, inheritedFrom };
}

/**
 * Resolve labor Stripe tax code for a work context:
 * item labor override → category labor override → LaborTaxCodeDefault → null.
 */
export function resolveLaborTaxCode(
  item: TaxableItem,
  category: TaxableCategory,
  workContext: WorkContext,
  defaults: LaborTaxDefaults,
): {
  stripeTaxCodeId: string | null;
  inheritedFrom: "item" | "category" | "default" | null;
  taxProfile: MaterialTaxProfile | null;
} {
  const { taxProfile } = resolveItemTaxClassification(item, category);

  const itemOverride =
    workContext === "INSTALL"
      ? item.laborInstallTaxCodeId?.trim() || null
      : item.laborServiceTaxCodeId?.trim() || null;
  if (itemOverride) {
    return {
      stripeTaxCodeId: itemOverride,
      inheritedFrom: "item",
      taxProfile,
    };
  }

  const categoryOverride =
    workContext === "INSTALL"
      ? category.laborInstallTaxCodeId?.trim() || null
      : category.laborServiceTaxCodeId?.trim() || null;
  if (categoryOverride) {
    return {
      stripeTaxCodeId: categoryOverride,
      inheritedFrom: "category",
      taxProfile,
    };
  }

  if (!taxProfile) {
    return { stripeTaxCodeId: null, inheritedFrom: null, taxProfile: null };
  }

  const row = defaults.find(
    (d) => d.taxProfile === taxProfile && d.workContext === workContext,
  );
  if (row?.stripeTaxCodeId) {
    return {
      stripeTaxCodeId: row.stripeTaxCodeId,
      inheritedFrom: "default",
      taxProfile,
    };
  }

  return { stripeTaxCodeId: null, inheritedFrom: null, taxProfile };
}

/** Canonical labor defaults (mirrors seed). Used in unit tests. */
export const CANONICAL_LABOR_TAX_DEFAULTS: LaborTaxDefaults = [
  {
    taxProfile: "REAL_PROPERTY",
    workContext: "INSTALL",
    stripeTaxCodeId: "txcd_20020010",
  },
  {
    taxProfile: "REAL_PROPERTY",
    workContext: "SERVICE",
    stripeTaxCodeId: "txcd_20080007",
  },
  {
    taxProfile: "TPP",
    workContext: "INSTALL",
    stripeTaxCodeId: "txcd_20020018",
  },
  {
    taxProfile: "TPP",
    workContext: "SERVICE",
    stripeTaxCodeId: "txcd_20080005",
  },
];
