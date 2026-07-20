/**
 * Sync canonical attribute lists into the ops DB.
 * Upserts attributes/options, renames length_feet → patch_cable_length,
 * hard-deletes vendor, deactivates color, deactivates stale options.
 */
import type { PrismaClient } from "@prisma/client";
import {
  ATTRIBUTE_SLUG_RENAMES,
  ATTRIBUTE_SLUGS_TO_DEACTIVATE,
  ATTRIBUTE_SLUGS_TO_DELETE,
  CANONICAL_ATTRIBUTE_LISTS,
} from "../src/features/materials/attribute-list-defs";

export type SyncAttributeListsResult = {
  attributesUpserted: number;
  optionsUpserted: number;
  optionsDeactivated: number;
  attributesDeleted: string[];
  attributesDeactivated: string[];
  slugsRenamed: string[];
};

export async function syncAttributeLists(
  prisma: PrismaClient,
): Promise<SyncAttributeListsResult> {
  const result: SyncAttributeListsResult = {
    attributesUpserted: 0,
    optionsUpserted: 0,
    optionsDeactivated: 0,
    attributesDeleted: [],
    attributesDeactivated: [],
    slugsRenamed: [],
  };

  for (const [fromSlug, toSlug] of Object.entries(ATTRIBUTE_SLUG_RENAMES)) {
    const existing = await prisma.materialAttribute.findUnique({
      where: { slug: fromSlug },
    });
    if (!existing) continue;
    const conflict = await prisma.materialAttribute.findUnique({
      where: { slug: toSlug },
    });
    if (conflict) {
      // Target already exists — delete the old slug after clearing dependents.
      await hardDeleteAttribute(prisma, existing.id);
      result.attributesDeleted.push(fromSlug);
    } else {
      const def = CANONICAL_ATTRIBUTE_LISTS.find((d) => d.slug === toSlug);
      await prisma.materialAttribute.update({
        where: { id: existing.id },
        data: {
          slug: toSlug,
          name: def?.name ?? existing.name,
          isActive: true,
        },
      });
      result.slugsRenamed.push(`${fromSlug}→${toSlug}`);
    }
  }

  for (const slug of ATTRIBUTE_SLUGS_TO_DELETE) {
    const attr = await prisma.materialAttribute.findUnique({
      where: { slug },
    });
    if (!attr) continue;
    await hardDeleteAttribute(prisma, attr.id);
    result.attributesDeleted.push(slug);
  }

  for (const slug of ATTRIBUTE_SLUGS_TO_DEACTIVATE) {
    const attr = await prisma.materialAttribute.findUnique({
      where: { slug },
    });
    if (!attr) continue;
    await prisma.materialAttribute.update({
      where: { id: attr.id },
      data: { isActive: false },
    });
    result.attributesDeactivated.push(slug);
  }

  for (const def of CANONICAL_ATTRIBUTE_LISTS) {
    const inputType = def.inputType ?? "SELECT";
    const attr = await prisma.materialAttribute.upsert({
      where: { slug: def.slug },
      create: {
        slug: def.slug,
        name: def.name,
        inputType,
        isActive: true,
      },
      update: {
        name: def.name,
        inputType,
        isActive: true,
      },
    });
    result.attributesUpserted += 1;

    if (inputType !== "SELECT" && inputType !== "MULTISELECT") {
      continue;
    }

    const canonicalValues = new Set(def.options.map((o) => o.value));

    for (const opt of def.options) {
      await prisma.materialAttributeOption.upsert({
        where: {
          attributeId_value: {
            attributeId: attr.id,
            value: opt.value,
          },
        },
        create: {
          attributeId: attr.id,
          value: opt.value,
          label: opt.label,
          sortOrder: opt.sortOrder,
          isActive: true,
        },
        update: {
          label: opt.label,
          sortOrder: opt.sortOrder,
          isActive: true,
        },
      });
      result.optionsUpserted += 1;
    }

    const stale = await prisma.materialAttributeOption.findMany({
      where: {
        attributeId: attr.id,
        isActive: true,
        NOT: { value: { in: [...canonicalValues] } },
      },
      select: { id: true },
    });
    if (stale.length > 0) {
      await prisma.materialAttributeOption.updateMany({
        where: { id: { in: stale.map((s) => s.id) } },
        data: { isActive: false },
      });
      result.optionsDeactivated += stale.length;
    }
  }

  return result;
}

async function hardDeleteAttribute(prisma: PrismaClient, attributeId: string) {
  const options = await prisma.materialAttributeOption.findMany({
    where: { attributeId },
    select: { id: true },
  });
  const optionIds = options.map((o) => o.id);

  if (optionIds.length > 0) {
    await prisma.materialAttributeAssignment.updateMany({
      where: { defaultOptionId: { in: optionIds } },
      data: { defaultOptionId: null },
    });
    await prisma.materialItemAttributeValue.deleteMany({
      where: { optionId: { in: optionIds } },
    });
  }

  await prisma.materialItemAttributeValue.deleteMany({
    where: { attributeId },
  });
  await prisma.materialAttributeAssignment.deleteMany({
    where: { attributeId },
  });
  await prisma.materialAttribute.delete({
    where: { id: attributeId },
  });
}

async function main() {
  const { prisma } = await import("../src/lib/prisma");
  console.log("Syncing attribute lists…");
  const result = await syncAttributeLists(prisma);
  console.log(JSON.stringify(result, null, 2));
  await prisma.$disconnect();
}

const isDirectRun =
  typeof process.argv[1] === "string" &&
  process.argv[1].replace(/\\/g, "/").endsWith("sync-attribute-lists.ts");

if (isDirectRun) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
