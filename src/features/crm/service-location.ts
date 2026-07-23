export type CustomerType = "RESIDENTIAL" | "COMMERCIAL" | "STR";

/**
 * Owning division is derived from customer type so accounts cannot be miscategorized.
 * Commercial + Residential → Integrated Systems. STR → Cabin Services.
 */
export function owningDivisionSlugForCustomerType(
  type: CustomerType,
): "integrated-systems" | "cabin-services" {
  if (type === "STR") return "cabin-services";
  return "integrated-systems";
}

export function customerTypeDivisionError(
  type: CustomerType,
  divisionSlug: string,
): string | null {
  const expected = owningDivisionSlugForCustomerType(type);
  if (divisionSlug !== expected) {
    if (type === "COMMERCIAL") {
      return "Commercial clients must use the Integrated Systems division.";
    }
    if (type === "STR") {
      return "STR clients must use the Cabin Services division.";
    }
    return "Residential clients must use the Integrated Systems division.";
  }
  return null;
}

export type ServiceLocationClassification = "RESIDENTIAL" | "COMMERCIAL";
export type ServiceLine = "INTEGRATED_SYSTEMS" | "CABIN_SERVICES";

export const SERVICE_LINES = [
  "INTEGRATED_SYSTEMS",
  "CABIN_SERVICES",
] as const satisfies readonly ServiceLine[];

export function serviceLineLabel(line: ServiceLine): string {
  return line === "INTEGRATED_SYSTEMS"
    ? "Integrated Systems"
    : "Cabin Services";
}

export function classificationLabel(
  c: ServiceLocationClassification,
): string {
  return c === "COMMERCIAL" ? "Commercial" : "Residential";
}

/** Commercial sites → Integrated Systems only. Residential needs ≥1 line. */
export function normalizeServiceLines(
  classification: ServiceLocationClassification,
  serviceLines: ServiceLine[],
): ServiceLine[] {
  if (classification === "COMMERCIAL") {
    return ["INTEGRATED_SYSTEMS"];
  }
  const unique = [...new Set(serviceLines.filter(Boolean))];
  return unique.length > 0 ? unique : ["INTEGRATED_SYSTEMS"];
}

export function validateServiceLines(
  classification: ServiceLocationClassification,
  serviceLines: ServiceLine[],
): string | null {
  if (classification === "COMMERCIAL") {
    // After normalize, commercial is always IS-only; still guard raw payloads.
    if (
      serviceLines.length !== 1 ||
      serviceLines[0] !== "INTEGRATED_SYSTEMS"
    ) {
      return "Commercial locations can only use Integrated Systems.";
    }
    return null;
  }
  if (serviceLines.length === 0) {
    return "Select at least one service line.";
  }
  return null;
}

export function locationDisplayName(loc: {
  siteName: string | null;
  line1: string;
}): string {
  return loc.siteName?.trim() || loc.line1;
}

/** Normalize address for duplicate checks. */
export function normalizeAddressKey(parts: {
  line1: string;
  city: string;
  region: string;
  postalCode: string;
}): string {
  return [parts.line1, parts.city, parts.region, parts.postalCode]
    .map((s) => s.trim().toLowerCase().replace(/\s+/g, " "))
    .join("|");
}

/**
 * Derive classification + service lines for a location created from the root org.
 */
export function rootOrgServiceLocationDefaults(opts: {
  customerType: "RESIDENTIAL" | "COMMERCIAL" | "STR";
  divisionSlug: string;
}): {
  classification: ServiceLocationClassification;
  serviceLines: ServiceLine[];
} {
  if (opts.customerType === "COMMERCIAL") {
    return {
      classification: "COMMERCIAL",
      serviceLines: ["INTEGRATED_SYSTEMS"],
    };
  }
  if (
    opts.customerType === "STR" ||
    opts.divisionSlug === "cabin-services"
  ) {
    return {
      classification: "RESIDENTIAL",
      serviceLines: ["CABIN_SERVICES"],
    };
  }
  return {
    classification: "RESIDENTIAL",
    serviceLines: ["INTEGRATED_SYSTEMS"],
  };
}
