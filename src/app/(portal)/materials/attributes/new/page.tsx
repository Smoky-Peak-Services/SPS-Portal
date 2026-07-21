import Link from "next/link";
import { requireDesktopSurface } from "@/lib/require-desktop";
import { AttributeForm } from "@/features/materials/components/attribute-form";
import { PageHeader } from "@/components/patterns/page-header";
import { Panel } from "@/components/patterns/panel";
import { Button } from "@/components/ui/button";

export default async function NewAttributePage() {
  await requireDesktopSurface("/materials/attributes/new");

  return (
    <div className="space-y-6">
      <PageHeader
        title="New attribute"
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/materials/attributes">Attributes</Link>
          </Button>
        }
      />
      <Panel>
        <AttributeForm />
      </Panel>
    </div>
  );
}
