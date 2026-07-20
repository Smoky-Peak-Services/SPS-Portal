import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { AppRole } from "@/config/permissions";
import {
  canAccess,
  defaultCapabilitiesForRole,
  defaultRouteForRole,
  resolveCapabilities,
  userCan,
  type Area,
  type PermissionSubject,
} from "@/config/permissions";
import type { CapabilityId } from "@/config/capabilities";

export type SessionUser = PermissionSubject & {
  id: string;
  name: string;
  email: string;
  role: AppRole;
  phone: string | null;
};

export async function getSession() {
  // RSCs cannot Set-Cookie. Disable refresh here so we don't extend DB expiresAt
  // without updating the browser cookie; SessionWatchdog refreshes via the client.
  return auth.api.getSession({
    headers: await headers(),
    query: { disableRefresh: true },
  });
}

async function loadCapabilities(
  userId: string,
  role: AppRole,
  email: string,
): Promise<Set<string>> {
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

  return resolveCapabilities({
    email,
    role,
    roleAllows,
    overrides,
  });
}

export async function requireUser(): Promise<SessionUser> {
  const session = await getSession();
  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, role: true, phone: true },
  });

  if (!user) {
    redirect("/sign-in");
  }

  const role = user.role as AppRole;
  const capabilities = await loadCapabilities(user.id, role, user.email);

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role,
    phone: user.phone,
    capabilities,
  };
}

export async function requireArea(area: Area): Promise<SessionUser> {
  const user = await requireUser();
  if (!canAccess(user, area)) {
    redirect(defaultRouteForRole(user.role));
  }
  return user;
}

export async function requireCapability(
  capability: CapabilityId | string,
): Promise<SessionUser> {
  const user = await requireUser();
  if (!userCan(user, capability)) {
    throw new Error("You do not have permission for this action");
  }
  return user;
}

/** Soft check after requireUser — throws instead of redirect. */
export function assertCapability(
  user: SessionUser,
  capability: CapabilityId | string,
): void {
  if (!userCan(user, capability)) {
    throw new Error("You do not have permission for this action");
  }
}
