/**
 * Right-to-erasure purge stub (lead-focused until CRM returns).
 *
 * When wired to a cron:
 * 1. Find closed PII leads older than company.retention.leadArchiveYears and delete
 *    (cascades lead-scoped activities)
 * 2. When Customer/CRM models return: archive past customerArchiveYears, then
 *    hard-delete PII customers and cascade-related ops rows by string id match
 *
 * This module is intentionally a no-op skeleton so the erasure path is documented
 * before tax/billing complexity lands.
 */
import { company } from "@/config/company";
import { DateTime } from "luxon";

export type PurgeResult = {
  customersPurged: number;
  leadsPurged: number;
  dryRun: boolean;
};

export async function runPurge(
  opts: { dryRun?: boolean } = {},
): Promise<PurgeResult> {
  const dryRun = opts.dryRun ?? true;
  const customerCutoff = DateTime.now()
    .minus({ years: company.retention.customerArchiveYears })
    .toJSDate();
  const leadCutoff = DateTime.now()
    .minus({ years: company.retention.leadArchiveYears })
    .toJSDate();

  // Placeholder — implement when cron is connected.
  console.info("[purge] stub", { dryRun, customerCutoff, leadCutoff });

  return { customersPurged: 0, leadsPurged: 0, dryRun };
}
