import { company } from "./company";
import {
  ALL_CAPABILITY_IDS,
  type CapabilityId,
  DEFAULT_ROLE_CAPABILITIES,
} from "./capabilities";
import type { CapabilityEffect, Role } from "@prisma/client";

export type AppRole = Role;

export const ALL_ROLES: AppRole[] = [
  "admin",
  "power_user",
  "sales",
  "accounting",
  "field_supervisor",
  "field_tech",
];

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Admin",
  power_user: "Power User",
  sales: "Sales / Estimating",
  accounting: "Accounting",
  field_supervisor: "Field Supervisor",
  field_tech: "Field Technician",
};

/** Areas still used for route grouping; access = `{area}.access` capability. */
export const AREA_ACCESS_CAPABILITY = {
  dashboard: "dashboard.access",
  materials: "materials.access",
  settings: "settings.permissions.manage",
} as const satisfies Record<string, CapabilityId>;

export type Area = keyof typeof AREA_ACCESS_CAPABILITY;

export type CapabilityOverride = {
  capabilityId: string;
  effect: CapabilityEffect;
};

export type PermissionSubject = {
  email: string;
  role: AppRole;
  /** Resolved capability ids the user currently has. */
  capabilities: ReadonlySet<string>;
};

export function isRootAdmin(email?: string | null): boolean {
  return !!email && email === company.rootAdminEmail;
}

/**
 * Resolve effective capabilities from role matrix rows + user overrides.
 * Deny wins over allow. Root admin gets everything.
 */
export function resolveCapabilities(input: {
  email: string;
  role: AppRole;
  roleAllows: Iterable<string>;
  overrides: CapabilityOverride[];
}): Set<string> {
  if (isRootAdmin(input.email)) {
    return new Set(ALL_CAPABILITY_IDS);
  }

  const caps = new Set<string>();
  for (const id of input.roleAllows) caps.add(id);

  // Apply DENY first, then ALLOW (deny still wins if both present — process deny last)
  for (const o of input.overrides) {
    if (o.effect === "ALLOW") caps.add(o.capabilityId);
  }
  for (const o of input.overrides) {
    if (o.effect === "DENY") caps.delete(o.capabilityId);
  }

  return caps;
}

/** Fallback when DB matrix not loaded yet (tests / boot). */
export function defaultCapabilitiesForRole(role: AppRole): Set<string> {
  return new Set(DEFAULT_ROLE_CAPABILITIES[role] ?? []);
}

export function userCan(
  user: PermissionSubject,
  capability: CapabilityId | string,
): boolean {
  if (isRootAdmin(user.email)) return true;
  return user.capabilities.has(capability);
}

export function canAccess(user: PermissionSubject, area: Area): boolean {
  if (area === "settings") {
    return (
      userCan(user, "settings.permissions.manage") ||
      userCan(user, "settings.users.manage")
    );
  }
  return userCan(user, AREA_ACCESS_CAPABILITY[area]);
}

export const OFFICE_ROLES: AppRole[] = [
  "admin",
  "power_user",
  "sales",
  "accounting",
];

export function isOfficeRole(role: AppRole): boolean {
  return OFFICE_ROLES.includes(role);
}

export const INVITABLE_ROLES: Record<AppRole, AppRole[]> = {
  admin: ALL_ROLES,
  power_user: ["power_user", "sales", "field_supervisor", "field_tech"],
  sales: ["sales"],
  accounting: [],
  field_supervisor: ["field_tech"],
  field_tech: [],
};

export function invitableRoles(role: AppRole): AppRole[] {
  return INVITABLE_ROLES[role];
}

export function canInvite(actor: AppRole, target: AppRole): boolean {
  return INVITABLE_ROLES[actor].includes(target);
}

export function canManageUsers(role: AppRole): boolean {
  return INVITABLE_ROLES[role].length > 0;
}

export function defaultRouteForRole(_role: AppRole): string {
  return "/";
}
