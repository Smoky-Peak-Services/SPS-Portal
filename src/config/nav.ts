import type { FeatureFlag } from "@/config/company";
import type { AppRole } from "@/config/permissions";
import type { DeviceSurface } from "@/lib/device-surface";

export type NavSurface = "mobile" | "desktop" | "both";

export interface NavItem {
  label: string;
  href: string;
  icon: string;
  feature?: FeatureFlag;
  roles?: AppRole[];
  /** Default both — desktop-only items hidden on mobile surface. */
  surface?: NavSurface;
}

export interface NavSection {
  id: string;
  label: string;
  items: NavItem[];
}

export const navSections: NavSection[] = [
  {
    id: "operations",
    label: "Operations",
    items: [
      {
        label: "Dashboard",
        href: "/",
        icon: "LayoutDashboard",
        roles: ["admin", "staff", "sales"],
        surface: "desktop",
      },
      {
        label: "My Day",
        href: "/field/today",
        icon: "ClipboardList",
        roles: ["admin", "staff", "field"],
        surface: "both",
      },
      {
        label: "Schedule",
        href: "/schedule",
        icon: "Calendar",
        feature: "scheduling",
        roles: ["admin", "staff", "field"],
        surface: "both",
      },
      {
        label: "Jobs",
        href: "/jobs",
        icon: "Wrench",
        roles: ["admin", "staff", "sales", "field"],
        surface: "both",
      },
      {
        label: "Service Tickets",
        href: "/tickets",
        icon: "LifeBuoy",
        roles: ["admin", "staff", "sales", "field"],
        surface: "both",
      },
      {
        label: "Clients",
        href: "/clients",
        icon: "Users",
        roles: ["admin", "staff", "sales"],
        surface: "desktop",
      },
    ],
  },
];

export const navFooterItems: NavItem[] = [
  {
    label: "Account",
    href: "/account",
    icon: "CircleUser",
    roles: ["admin", "staff", "sales", "field"],
    surface: "both",
  },
];

function itemAllowedOnSurface(item: NavItem, surface: DeviceSurface): boolean {
  const s = item.surface ?? "both";
  if (s === "both") return true;
  return s === surface;
}

export function filterNavForRole(
  role: AppRole,
  sections: NavSection[] = navSections,
  surface: DeviceSurface = "desktop",
): NavSection[] {
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) =>
          (!item.roles || item.roles.includes(role)) &&
          itemAllowedOnSurface(item, surface),
      ),
    }))
    .filter((section) => section.items.length > 0);
}

export function filterFooterForRole(
  role: AppRole,
  surface: DeviceSurface = "desktop",
): NavItem[] {
  return navFooterItems.filter(
    (item) =>
      (!item.roles || item.roles.includes(role)) &&
      itemAllowedOnSurface(item, surface),
  );
}
