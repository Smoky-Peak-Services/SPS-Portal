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
    if (serviceLines.some((d) => d === "CABIN_SERVICES")) {
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
