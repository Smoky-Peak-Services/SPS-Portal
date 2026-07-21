import Link from "next/link";
import { requireDesktopSurface } from "@/lib/require-desktop";
import { requireArea } from "@/lib/session";
import { canForceDelete } from "@/features/materials/authz";
import { userCan } from "@/config/permissions";
import { listAttributes } from "@/features/materials/actions";
import { getActiveScope } from "@/features/scope/get-active-scope";
import { AttributeDeleteCell } from "@/features/materials/components/attribute-delete-cell";
import { AttributeAssignmentIoToolbar } from "@/features/materials/components/attribute-assignment-io-toolbar";
import { MaterialsAttributeListsIoClient } from "@/features/materials/components/materials-attribute-lists-io-client";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/patterns/page-header";
import { DataTableShell } from "@/components/patterns/data-table-shell";
import { Panel } from "@/components/patterns/panel";
import { EmptyState } from "@/components/patterns/empty-state";

export default async function AttributesPage({
  searchParams,
}: {
  searchParams: Promise<{ divisionId?: string; segment?: string }>;
}) {
  await requireDesktopSurface("/materials/attributes");
  const user = await requireArea("materials");
  const scope = await getActiveScope(await searchParams);
  const { divisionId, segment } = scope;

  const attributes = await listAttributes({ divisionId, segment });
  const isAdmin = canForceDelete(user);
  const canIo = userCan(user, "materials.import_export");

  const scopeQuery = `divisionId=${encodeURIComponent(divisionId)}&segment=${encodeURIComponent(segment)}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attributes"
        description="Per-scope definitions — each attribute belongs to one division + segment and is assigned to that scope's categories."
        actions={
          <Button asChild>
            <Link href={`/materials/attributes/new?${scopeQuery}`}>
              New attribute
            </Link>
          </Button>
        }
      />
      {canIo ? (
        <Panel title="Attribute Excel">
          <div className="space-y-3">
            <AttributeAssignmentIoToolbar
              isAdmin={isAdmin}
              divisionId={divisionId}
              segment={segment}
            />
            <MaterialsAttributeListsIoClient
              isAdmin={isAdmin}
              divisionId={divisionId}
              segment={segment}
            />
          </div>
        </Panel>
      ) : null}
      {attributes.length === 0 ? (
        <EmptyState
          title={`No attributes in the ${scope.divisionName} · ${segment} catalog yet.`}
          description="Attributes are per-scope. Create one here or import an attribute-lists workbook for this scope."
          action={
            <Button asChild>
              <Link href={`/materials/attributes/new?${scopeQuery}`}>
                New attribute
              </Link>
            </Button>
          }
        />
      ) : (
        <DataTableShell>
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Slug</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Options</th>
                <th className="px-4 py-3">Assignments</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {attributes.map((a) => (
                <tr key={a.id} className="border-b last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      href={`/materials/attributes/${a.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {a.name}
                    </Link>
                    {!a.isActive ? (
                      <span className="ml-2 text-xs text-muted-foreground">
                        inactive
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{a.slug}</td>
                  <td className="px-4 py-3">{a.inputType}</td>
                  <td className="px-4 py-3">{a._count.options}</td>
                  <td className="px-4 py-3">{a._count.assignments}</td>
                  <td className="px-4 py-3">
                    <AttributeDeleteCell
                      id={a.id}
                      name={a.name}
                      usageCount={a._count.assignments}
                      isAdmin={isAdmin}
                    />
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
