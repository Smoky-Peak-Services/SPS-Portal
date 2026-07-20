import { company } from "./company";

export type AppRole = "admin" | "staff" | "sales" | "field";

export const ALL_ROLES: AppRole[] = ["admin", "staff", "sales", "field"];

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Admin",
  staff: "Staff",
  sales: "Estimating / Sales",
  field: "Field Tech",
};

// Trimmed shell + materials catalog. Add areas back (customers, jobs,
// tickets, schedule, myDay, ...) as each feature is rebuilt.
export const AREA_ROLES = {
  dashboard: ["admin", "staff", "sales", "field"],
  materials: ["admin", "staff"],
  settings: ["admin"],
} satisfies Record<string, AppRole[]>;

export type Area = keyof typeof AREA_ROLES;

export function canAccess(role: AppRole, area: Area): boolean {
  return (AREA_ROLES[area] as readonly AppRole[]).includes(role);
}

export const OFFICE_ROLES: AppRole[] = ["admin", "staff", "sales"];

export function isOfficeRole(role: AppRole): boolean {
  return OFFICE_ROLES.includes(role);
}

export const INVITABLE_ROLES: Record<AppRole, AppRole[]> = {
  admin: ["admin", "staff", "sales", "field"],
  staff: ["staff", "field"],
  sales: ["sales"],
  field: [],
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
  // Every role lands on the dashboard until per-role landing pages exist again.
  return "/";
}

export function isRootAdmin(email?: string | null): boolean {
  return !!email && email === company.rootAdminEmail;
}
