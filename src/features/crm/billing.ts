export interface BillingProfileFields {
  billingName: string | null;
  billingEmail: string | null;
  billingLine1: string | null;
  billingCity: string | null;
  billingRegion: string | null;
  billingPostal: string | null;
}

/** What's missing from a billing profile (empty = complete). */
export function billingMissing(c: BillingProfileFields): string[] {
  const missing: string[] = [];
  if (!c.billingName?.trim()) missing.push("billing name");
  if (!c.billingEmail?.trim()) missing.push("billing email");
  if (
    !(c.billingLine1 && c.billingCity && c.billingRegion && c.billingPostal)
  ) {
    missing.push("billing address");
  }
  return missing;
}

export function isBillingComplete(c: BillingProfileFields): boolean {
  return billingMissing(c).length === 0;
}
