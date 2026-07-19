/**
 * Right-to-erasure purge stub.
 *
 * When wired to a cron:
 * 1. Find PII customers with archivedAt older than company.retention.customerArchiveYears
 * 2. Delete related ops jobs/tickets by customerId string match
 * 3. Hard-delete the PII customer (cascades contacts, locations, activities)
 * 4. Find closed leads older than leadArchiveYears and delete
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
