import Link from "next/link";
import { requireDesktopSurface } from "@/lib/require-desktop";
import { requireArea } from "@/lib/session";
import { isPiiConfigured } from "@/lib/prisma-pii";
import { listCrmDivisions } from "@/features/crm/queries";
import { canWriteCrm } from "@/features/crm/authz";
import { CreateCustomerForm } from "@/features/crm/components/create-customer-form";
import { PageHeader } from "@/components/patterns/page-header";
import { Panel } from "@/components/patterns/panel";
import { EmptyState } from "@/components/patterns/empty-state";
import { Button } from "@/components/ui/button";
import { redirect } from "next/navigation";

export default async function NewClientPage() {
  await requireDesktopSurface("/clients/new");
  const user = await requireArea("crm");
  if (!canWriteCrm(user)) redirect("/clients");

  if (!isPiiConfigured()) {
    return (
      <EmptyState
        title="PII database not configured"
        description="Cannot create clients without the PII database."
      />
    );
  }

  const divisions = await listCrmDivisions();

  return (
    <div className="space-y-6">
      <PageHeader
        title="New client"
        description="Creates the root org, an empty billing profile, and an optional primary contact."
        actions={
          <Button asChild variant="outline">
            <Link href="/clients">Back</Link>
          </Button>
        }
      />
      <Panel title="Root org">
        <CreateCustomerForm divisions={divisions} />
      </Panel>
    </div>
  );
}
