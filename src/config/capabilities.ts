import type { PrismaClient, Role } from "@prisma/client";

/** Stable capability IDs (also Capability.id PK). */
export const CAPABILITIES = [
  {
    id: "materials.access",
    label: "Materials — access",
    description: "Open Materials area and read catalog (subject to financials.view).",
    sortOrder: 10,
  },
  {
    id: "materials.catalog.write",
    label: "Materials — catalog write",
    description: "Create/edit domains, categories, items (non-financial fields).",
    sortOrder: 20,
  },
  {
    id: "materials.attributes.write",
    label: "Materials — attributes write",
    description: "Create/edit attribute definitions and options; manage assignments.",
    sortOrder: 30,
  },
  {
    id: "materials.financials.view",
    label: "Materials — financials view",
    description: "See costs, markup, waste, tax codes, labor tax overrides.",
    sortOrder: 40,
  },
  {
    id: "materials.financials.write",
    label: "Materials — financials write",
    description: "Edit cost/markup/waste/tax fields on categories and items.",
    sortOrder: 50,
  },
  {
    id: "materials.import_export",
    label: "Materials — import / export",
    description: "Run catalog and attribute-list import/export.",
    sortOrder: 60,
  },
  {
    id: "materials.delete",
    label: "Materials — delete",
    description: "Safe-delete catalog entities (blocked when children exist).",
    sortOrder: 70,
  },
  {
    id: "materials.force_delete",
    label: "Materials — force delete",
    description: "Force-delete with confirmation (cascades children).",
    sortOrder: 80,
  },
  {
    id: "materials.tax_review",
    label: "Materials — tax review",
    description: "Mark categories tax-reviewed; use needs-review filter.",
    sortOrder: 90,
  },
  {
    id: "settings.permissions.manage",
    label: "Settings — permissions",
    description: "Edit role capability matrix.",
    sortOrder: 100,
  },
  {
    id: "settings.users.manage",
    label: "Settings — users",
    description: "Change user roles and per-user capability overrides.",
    sortOrder: 110,
  },
  {
    id: "dashboard.access",
    label: "Dashboard — access",
    description: "Open the portal dashboard.",
    sortOrder: 1,
  },
] as const;

export type CapabilityId = (typeof CAPABILITIES)[number]["id"];

export const ALL_CAPABILITY_IDS: CapabilityId[] = CAPABILITIES.map((c) => c.id);

/** Seeded role × capability allow matrix (missing = deny). */
export const DEFAULT_ROLE_CAPABILITIES: Record<
  Role,
  readonly CapabilityId[]
> = {
  admin: ALL_CAPABILITY_IDS,
  power_user: [
    "dashboard.access",
    "materials.access",
    "materials.catalog.write",
    "materials.attributes.write",
    "materials.financials.view",
    "materials.financials.write",
    "materials.import_export",
    "materials.delete",
    "materials.tax_review",
  ],
  sales: [
    "dashboard.access",
    "materials.access",
    "materials.financials.view",
  ],
  accounting: [
    "dashboard.access",
    "materials.access",
    "materials.financials.view",
    "materials.financials.write",
    "materials.tax_review",
  ],
  field_supervisor: [
    "dashboard.access",
    "materials.access",
    "materials.financials.view",
  ],
  field_tech: ["dashboard.access"],
};

export async function seedCapabilities(prisma: PrismaClient): Promise<void> {
  for (const cap of CAPABILITIES) {
    await prisma.capability.upsert({
      where: { id: cap.id },
      create: {
        id: cap.id,
        label: cap.label,
        description: cap.description,
        sortOrder: cap.sortOrder,
      },
      update: {
        label: cap.label,
        description: cap.description,
        sortOrder: cap.sortOrder,
      },
    });
  }

  const roles = Object.keys(DEFAULT_ROLE_CAPABILITIES) as Role[];
  for (const role of roles) {
    const allowed = new Set(DEFAULT_ROLE_CAPABILITIES[role]);
    for (const cap of CAPABILITIES) {
      await prisma.roleCapability.upsert({
        where: {
          role_capabilityId: { role, capabilityId: cap.id },
        },
        create: {
          role,
          capabilityId: cap.id,
          allowed: allowed.has(cap.id),
        },
        // Preserve admin toggles after first seed
        update: { capabilityId: cap.id },
      });
    }
  }
}

/**
 * Reset role matrix to code defaults (used by seed / admin "reset defaults").
 */
export async function resetRoleCapabilitiesToDefaults(
  prisma: PrismaClient,
): Promise<void> {
  const roles = Object.keys(DEFAULT_ROLE_CAPABILITIES) as Role[];
  for (const role of roles) {
    const allowed = new Set(DEFAULT_ROLE_CAPABILITIES[role]);
    for (const cap of CAPABILITIES) {
      await prisma.roleCapability.upsert({
        where: {
          role_capabilityId: { role, capabilityId: cap.id },
        },
        create: {
          role,
          capabilityId: cap.id,
          allowed: allowed.has(cap.id),
        },
        update: { allowed: allowed.has(cap.id) },
      });
    }
  }
}
