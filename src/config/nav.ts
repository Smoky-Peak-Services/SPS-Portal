import type { FeatureFlag } from "@/config/company";
import type { AppRole } from "@/config/permissions";

export interface NavItem {
  label: string;
  href: string;
  icon: string;
  feature?: FeatureFlag;
  roles?: AppRole[];
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
      },
      {
        label: "My Day",
        href: "/field/today",
        icon: "ClipboardList",
        roles: ["admin", "staff", "field"],
      },
      {
        label: "Schedule",
        href: "/schedule",
        icon: "Calendar",
        feature: "scheduling",
        roles: ["admin", "staff", "field"],
      },
      {
        label: "Jobs",
        href: "/jobs",
        icon: "Wrench",
        roles: ["admin", "staff", "sales", "field"],
      },
      {
        label: "Service Tickets",
        href: "/tickets",
        icon: "LifeBuoy",
        roles: ["admin", "staff", "sales", "field"],
      },
      {
        label: "Clients",
        href: "/clients",
        icon: "Users",
        roles: ["admin", "staff", "sales"],
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
  },
];

export function filterNavForRole(
  role: AppRole,
  sections: NavSection[] = navSections,
): NavSection[] {
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) => !item.roles || item.roles.includes(role),
      ),
    }))
    .filter((section) => section.items.length > 0);
}
