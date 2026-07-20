import { prisma } from "@/lib/prisma";
import {
  defaultCapabilitiesForRole,
  resolveCapabilities,
  userCan,
  type AppRole,
  type PermissionSubject,
} from "@/config/permissions";

/** Load permission subject for API routes (no redirect). */
export async function loadPermissionSubject(
  userId: string,
): Promise<PermissionSubject | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true },
  });
  if (!user) return null;

  const role = user.role as AppRole;
  const [roleRows, overrides] = await Promise.all([
    prisma.roleCapability.findMany({
      where: { role, allowed: true },
      select: { capabilityId: true },
    }),
    prisma.userCapabilityOverride.findMany({
      where: { userId },
      select: { capabilityId: true, effect: true },
    }),
  ]);

  const roleAllows =
    roleRows.length > 0
      ? roleRows.map((r) => r.capabilityId)
      : [...defaultCapabilitiesForRole(role)];

  return {
    email: user.email,
    role,
    capabilities: resolveCapabilities({
      email: user.email,
      role,
      roleAllows,
      overrides,
    }),
  };
}

export function subjectCan(
  subject: PermissionSubject,
  capability: string,
): boolean {
  return userCan(subject, capability);
}
