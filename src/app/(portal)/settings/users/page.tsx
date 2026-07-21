import Link from "next/link";
import { requireDesktopSurface } from "@/lib/require-desktop";
import { requireCapability } from "@/lib/session";
import { listUsersForSettings } from "@/features/settings/actions";
import { UsersPermissionsPanel } from "@/features/settings/components/users-permissions-panel";
import type { AppRole } from "@/config/permissions";

export default async function UsersSettingsPage() {
  await requireDesktopSurface("/settings/users");
  await requireCapability("settings.users.manage");
  const users = await listUsersForSettings();

  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Dashboard
        </Link>
        <h1 className="text-2xl font-semibold">Users & overrides</h1>
        <p className="text-sm text-muted-foreground">
          Change a user&apos;s role or override individual capabilities.
        </p>
      </div>
      <UsersPermissionsPanel
        users={users.map((u) => ({
          ...u,
          role: u.role as AppRole,
        }))}
      />
    </div>
  );
}
