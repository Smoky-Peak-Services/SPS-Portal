import type { MaterialTaxProfile, WorkContext } from "@prisma/client";

/**
 * Material / labor tax classification helpers.
 * Profile is derived from the material Stripe tax code:
 *   txcd_00000000 (Nontaxable) or unset → REAL_PROPERTY
 *   any other code → TPP
 * Labor: install/service overrides → LaborTaxCodeDefault by derived profile × WorkContext.
 * Parts sales always use txcd_99999999 (no quote UI yet — resolver only).
 * See claude/prompts/05-materials-tax-code-linkage.md
 * Never invent a Stripe tax code for install/service material lines — leave null if unset.
 */

/** Nontaxable — drives REAL_PROPERTY classification. */
export const NONTAXABLE_TAX_CODE_ID = "txcd_00000000";

/** General Tangible Goods — always used for parts sales. */
export const PARTS_SALE_TAX_CODE_ID = "txcd_99999999";

/** Sale channel for material tax-code resolution (quoting later). */
export type SaleType = "INSTALL_JOB" | "SERVICE_JOB" | "PARTS";

export type TaxClassification = {
  taxProfile: MaterialTaxProfile;
  stripeTaxCodeId: string | null;
  inheritedFrom: "item" | "category" | null;
};

export type LaborTaxDefaults = {
  taxProfile: MaterialTaxProfile;
  workContext: WorkContext;
  stripeTaxCodeId: string;
}[];

type TaxableItem = {
  taxProfile?: MaterialTaxProfile | null;
  stripeTaxCodeId: string | null;
  laborInstallTaxCodeId?: string | null;
  laborServiceTaxCodeId?: string | null;
};

type TaxableCategory = {
  taxProfile?: MaterialTaxProfile;
  stripeTaxCodeId: string | null;
  laborInstallTaxCodeId?: string | null;
  laborServiceTaxCodeId?: string | null;
};

/**
 * Derive REAL_PROPERTY vs TPP from the material Stripe tax code.
 * Nontaxable or unset → REAL_PROPERTY; any other code → TPP.
 */
export function deriveTaxProfileFromStripeCode(
  code: string | null | undefined,
): MaterialTaxProfile {
  const trimmed = code?.trim() || null;
  if (!trimmed || trimmed === NONTAXABLE_TAX_CODE_ID) {
    return "REAL_PROPERTY";
  }
  return "TPP";
}

function resolveMaterialCode(
  item: TaxableItem,
  category: TaxableCategory,
): string | null {
  return (
    item.stripeTaxCodeId?.trim() || category.stripeTaxCodeId?.trim() || null
  );
}

/** Resolve material tax metadata: item code → category code; profile from code. */
export function resolveItemTaxClassification(
  item: TaxableItem,
  category: TaxableCategory,
): TaxClassification {
  const stripeTaxCodeId = resolveMaterialCode(item, category);
  const taxProfile = deriveTaxProfileFromStripeCode(stripeTaxCodeId);

  let inheritedFrom: TaxClassification["inheritedFrom"] = null;
  if ((item.stripeTaxCodeId?.trim() ?? "") !== "") {
    inheritedFrom = "item";
  } else if (stripeTaxCodeId != null || category.stripeTaxCodeId != null) {
    inheritedFrom = "category";
  } else {
    // Unset code still yields REAL_PROPERTY; treat as category default.
    inheritedFrom = "category";
  }

  return { taxProfile, stripeTaxCodeId, inheritedFrom };
}

/**
 * Material Stripe tax code for a sale channel.
 * PARTS always uses General Tangible Goods; otherwise item→category inheritance.
 */
export function resolveMaterialStripeTaxCode(args: {
  saleType: SaleType;
  item: TaxableItem;
  category: TaxableCategory;
}): {
  stripeTaxCodeId: string | null;
  taxProfile: MaterialTaxProfile;
  inheritedFrom: "parts" | "item" | "category" | null;
} {
  if (args.saleType === "PARTS") {
    return {
      stripeTaxCodeId: PARTS_SALE_TAX_CODE_ID,
      taxProfile: deriveTaxProfileFromStripeCode(PARTS_SALE_TAX_CODE_ID),
      inheritedFrom: "parts",
    };
  }

  const classification = resolveItemTaxClassification(args.item, args.category);
  return {
    stripeTaxCodeId: classification.stripeTaxCodeId,
    taxProfile: classification.taxProfile,
    inheritedFrom: classification.inheritedFrom,
  };
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
  taxProfile: MaterialTaxProfile;
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
