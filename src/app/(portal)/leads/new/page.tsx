import Link from "next/link";
import { redirect } from "next/navigation";
import { requireDesktopSurface } from "@/lib/require-desktop";
import { requireArea } from "@/lib/session";
import { isPiiConfigured } from "@/lib/prisma-pii";
import { listCrmDivisions } from "@/features/crm/queries";
import { canWriteCrm } from "@/features/crm/authz";
import { CreateLeadForm } from "@/features/crm/components/create-lead-form";
import { PageHeader } from "@/components/patterns/page-header";
import { Panel } from "@/components/patterns/panel";
import { EmptyState } from "@/components/patterns/empty-state";
import { Button } from "@/components/ui/button";

export default async function NewLeadPage({
  searchParams,
}: {
  searchParams: Promise<{ phone?: string; message?: string }>;
}) {
  await requireDesktopSurface("/leads/new");
  const user = await requireArea("crm");
  if (!canWriteCrm(user)) redirect("/leads");

  if (!isPiiConfigured()) {
    return (
      <EmptyState
        title="PII database not configured"
        description="Cannot create leads without the PII database."
      />
    );
  }

  const sp = await searchParams;
  const divisions = await listCrmDivisions();

  return (
    <div className="space-y-6">
      <PageHeader
        title="New lead"
        description="Manual intake from the Call Log or walk-ins."
        actions={
          <Button asChild variant="outline">
            <Link href="/leads">Back</Link>
          </Button>
        }
      />
      <Panel title="Lead">
        <CreateLeadForm
          divisions={divisions}
          defaults={{ phone: sp.phone, message: sp.message }}
        />
      </Panel>
    </div>
  );
}
