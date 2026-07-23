/**
 * Right-to-erasure / history-retention purge stub.
 *
 * When wired to a cron:
 * 1. Find closed PII leads older than company.retention.leadArchiveYears and delete
 *    (cascades lead-scoped activities)
 * 2. Archive customers past customerArchiveYears, then hard-delete PII customers and
 *    cascade-related ops rows by string id match
 * 3. When estimates / service tickets / invoices exist: purge history older than
 *    company.retention.estimateHistoryYears, serviceTicketHistoryYears, and
 *    invoiceHistoryYears (currently 5 each). Do not invent those models here.
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
  const estimateCutoff = DateTime.now()
    .minus({ years: company.retention.estimateHistoryYears })
    .toJSDate();
  const serviceTicketCutoff = DateTime.now()
    .minus({ years: company.retention.serviceTicketHistoryYears })
    .toJSDate();
  const invoiceCutoff = DateTime.now()
    .minus({ years: company.retention.invoiceHistoryYears })
    .toJSDate();

  // Placeholder — implement when cron is connected and history entities exist.
  console.info("[purge] stub", {
    dryRun,
    customerCutoff,
    leadCutoff,
    estimateCutoff,
    serviceTicketCutoff,
    invoiceCutoff,
  });

  return { customersPurged: 0, leadsPurged: 0, dryRun };
}
