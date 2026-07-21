import Link from "next/link";
import { requireDesktopSurface } from "@/lib/require-desktop";
import { requireArea } from "@/lib/session";
import { canForceDelete } from "@/features/materials/authz";
import { userCan } from "@/config/permissions";
import { listDomains } from "@/features/materials/actions";
import { getActiveScope } from "@/features/scope/get-active-scope";
import { DomainDeleteCell } from "@/features/materials/components/domain-delete-cell";
import { DomainIoToolbar } from "@/features/materials/components/domain-io-toolbar";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/patterns/page-header";
import { DataTableShell } from "@/components/patterns/data-table-shell";
import { EmptyState } from "@/components/patterns/empty-state";

export default async function DomainsPage({
  searchParams,
}: {
  searchParams: Promise<{ divisionId?: string; segment?: string }>;
}) {
  await requireDesktopSurface("/materials/domains");
  const user = await requireArea("materials");
  const scope = await getActiveScope(await searchParams);
  const domains = await listDomains(scope);
  const isAdmin = canForceDelete(user);
  const canIo = userCan(user, "materials.import_export");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Domains"
        description={`Top-level material taxonomy for ${scope.divisionName} · ${scope.segment}.`}
        actions={
          <Button asChild>
            <Link href="/materials/domains/new">New domain</Link>
          </Button>
        }
      />
      {canIo ? <DomainIoToolbar isAdmin={isAdmin} /> : null}
      {domains.length === 0 ? (
        <EmptyState
          title={`No domains in the ${scope.divisionName} · ${scope.segment} catalog yet.`}
          description="Create the first domain for this scope, or import a domains workbook."
          action={
            <Button asChild>
              <Link href="/materials/domains/new">New domain</Link>
            </Button>
          }
        />
      ) : (
        <DataTableShell>
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Division</th>
                <th className="px-4 py-3">Segment</th>
                <th className="px-4 py-3">Categories</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {domains.map((d) => (
                <tr key={d.id} className="border-b last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      href={`/materials/domains/${d.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {d.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{d.division.name}</td>
                  <td className="px-4 py-3">{d.segment}</td>
                  <td className="px-4 py-3">{d._count.categories}</td>
                  <td className="px-4 py-3">
                    {d.isActive ? "Active" : "Inactive"}
                  </td>
                  <td className="px-4 py-3">
                    {isAdmin ? (
                      <DomainDeleteCell
                        id={d.id}
                        name={d.name}
                        categoryCount={d._count.categories}
                        isAdmin={isAdmin}
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTableShell>
      )}
    </div>
  );
}
