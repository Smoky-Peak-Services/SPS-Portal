import Link from "next/link";
import { requireDesktopSurface } from "@/lib/require-desktop";
import { requireArea } from "@/lib/session";
import { canForceDelete } from "@/features/materials/authz";
import { listAttributes } from "@/features/materials/actions";
import { AttributeDeleteCell } from "@/features/materials/components/attribute-delete-cell";
import { Button } from "@/components/ui/button";

export default async function AttributesPage() {
  await requireDesktopSurface("/materials/attributes");
  const user = await requireArea("materials");
  const attributes = await listAttributes();
  const isAdmin = canForceDelete(user);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/materials"
            className="text-sm text-slate-500 hover:underline"
          >
            ← Materials
          </Link>
          <h1 className="text-2xl font-semibold">Attributes</h1>
          <p className="text-sm text-slate-500">
            Global definitions — assign them to categories separately.
          </p>
        </div>
        <Button asChild>
          <Link href="/materials/attributes/new">New attribute</Link>
        </Button>
      </div>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
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
            {attributes.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  No attributes yet.
                </td>
              </tr>
            ) : (
              attributes.map((a) => (
                <tr key={a.id} className="border-b last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      href={`/materials/attributes/${a.id}`}
                      className="font-medium text-teal-900 hover:underline"
                    >
                      {a.name}
                    </Link>
                    {!a.isActive ? (
                      <span className="ml-2 text-xs text-slate-400">
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
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
