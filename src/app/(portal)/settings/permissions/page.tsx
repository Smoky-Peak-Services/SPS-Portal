import Link from "next/link";
import { requireDesktopSurface } from "@/lib/require-desktop";
import { requireCapability } from "@/lib/session";
import { listRoleCapabilityMatrix } from "@/features/settings/actions";
import { PermissionsMatrixForm } from "@/features/settings/components/permissions-matrix-form";
import type { AppRole } from "@/config/permissions";

export default async function PermissionsSettingsPage() {
  await requireDesktopSurface("/settings/permissions");
  await requireCapability("settings.permissions.manage");
  const { capabilities, roles, rows } = await listRoleCapabilityMatrix();

  return (
    <div className="space-y-4">
      <div>
        <Link href="/" className="text-sm text-slate-500 hover:underline">
          ← Dashboard
        </Link>
        <h1 className="text-2xl font-semibold">Role permissions</h1>
        <p className="text-sm text-slate-500">
          Toggle capabilities per role. Per-user overrides are on the Users
          page.
        </p>
      </div>
      <PermissionsMatrixForm
        capabilities={[...capabilities]}
        roles={roles as AppRole[]}
        initialRows={rows.map((r) => ({
          role: r.role as AppRole,
          capabilityId: r.capabilityId,
          allowed: r.allowed,
        }))}
      />
    </div>
  );
}
