import { requireDesktopSurface } from "@/lib/require-desktop";
import { requireArea } from "@/lib/session";
import { isPiiConfigured } from "@/lib/prisma-pii";
import { canWriteCrm } from "@/features/crm/authz";
import { recentCallLog } from "@/features/phone/queries";
import {
  CallLogClient,
  type CallLogRow,
} from "@/features/phone/components/call-log-client";
import { PageHeader } from "@/components/patterns/page-header";
import { EmptyState } from "@/components/patterns/empty-state";

export default async function CallLogPage() {
  await requireDesktopSurface("/call-log");
  const user = await requireArea("crm");

  if (!isPiiConfigured()) {
    return (
      <EmptyState
        title="PII database not configured"
        description="Call Log requires the PII database. Set PII_DATABASE_URL locally or CLIENT_DB_SECRET_ARN in production."
      />
    );
  }

  const groups = await recentCallLog();
  const rows: CallLogRow[] = groups.map((g) => ({
    key: g.key,
    display: g.display,
    partyE164: g.partyE164,
    leadMessage: g.leadMessage,
    lastAtMs: g.lastAt.getTime(),
    total: g.total,
    counts: g.counts,
    statusLine: g.statusLine,
    summary: g.summary,
    transcript: g.transcript,
    smsPreview: g.smsPreview,
    latestRecordingUrl: g.latestRecordingUrl,
    match: g.match,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Call Log"
        description="Inbound Quo calls, voicemails, texts, and AI summaries. Unknown numbers stay here until you triage; dismiss spam without creating CRM records."
      />
      <CallLogClient rows={rows} canWrite={canWriteCrm(user)} />
    </div>
  );
}
