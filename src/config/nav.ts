import type { DeviceSurface } from "@/lib/device-surface";
import type { CapabilityId } from "@/config/capabilities";

export type NavSurface = "mobile" | "desktop" | "both";

export interface NavItem {
  label: string;
  href: string;
  icon: string;
  /** Require any of these capabilities (empty = visible to all signed-in users). */
  capabilities?: CapabilityId[];
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
        capabilities: ["dashboard.access"],
        surface: "both",
      },
      {
        label: "Catalog",
        href: "/materials",
        icon: "Package",
        capabilities: ["materials.access"],
        surface: "desktop",
      },
      {
        label: "Rates",
        href: "/pricing",
        icon: "Gauge",
        capabilities: ["pricing.access"],
        surface: "desktop",
      },
    ],
  },
  {
    id: "admin",
    label: "Admin",
    items: [
      {
        label: "Permissions",
        href: "/settings/permissions",
        icon: "CircleUser",
        capabilities: ["settings.permissions.manage"],
        surface: "desktop",
      },
      {
        label: "Users",
        href: "/settings/users",
        icon: "CircleUser",
        capabilities: ["settings.users.manage"],
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
    surface: "both",
  },
];

function itemAllowedOnSurface(item: NavItem, surface: DeviceSurface): boolean {
  const s = item.surface ?? "both";
  if (s === "both") return true;
  return s === surface;
}

function itemAllowedByCaps(
  item: NavItem,
  capabilities: ReadonlySet<string>,
): boolean {
  if (!item.capabilities || item.capabilities.length === 0) return true;
  return item.capabilities.some((c) => capabilities.has(c));
}

export function filterNavForCapabilities(
  capabilities: ReadonlySet<string>,
  sections: NavSection[] = navSections,
  surface: DeviceSurface = "desktop",
): NavSection[] {
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) =>
          itemAllowedByCaps(item, capabilities) &&
          itemAllowedOnSurface(item, surface),
      ),
    }))
    .filter((section) => section.items.length > 0);
}

export function filterFooterForCapabilities(
  capabilities: ReadonlySet<string>,
  surface: DeviceSurface = "desktop",
): NavItem[] {
  return navFooterItems.filter(
    (item) =>
      itemAllowedByCaps(item, capabilities) &&
      itemAllowedOnSurface(item, surface),
  );
}

/** @deprecated Use filterNavForCapabilities */
export const filterNavForRole = (
  _role: unknown,
  sections?: NavSection[],
  surface?: DeviceSurface,
) => filterNavForCapabilities(new Set(["dashboard.access"]), sections, surface);
