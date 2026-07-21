/**
 * Sync canonical attribute lists into the ops DB.
 *
 * The canonical lists are Integrated Systems Commercial vocabulary — since
 * prompt 14 attributes are per-scope, this sync applies to the IS-Commercial
 * scope only. Other scopes build their own attributes via admin UI / import.
 *
 * Upserts attributes/options, renames length_feet → patch_cable_length,
 * hard-deletes vendor, deactivates color, deactivates stale options.
 */
import type { PrismaClient, Segment } from "@prisma/client";
import {
  ATTRIBUTE_SLUG_RENAMES,
  ATTRIBUTE_SLUGS_TO_DEACTIVATE,
  ATTRIBUTE_SLUGS_TO_DELETE,
  CANONICAL_ATTRIBUTE_LISTS,
} from "../src/features/materials/attribute-list-defs";

const CANONICAL_DIVISION_SLUG = "integrated-systems";
const CANONICAL_SEGMENT: Segment = "COMMERCIAL";

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
  const division = await prisma.division.findUnique({
    where: { slug: CANONICAL_DIVISION_SLUG },
    select: { id: true },
  });
  if (!division) {
    throw new Error(
      `Division "${CANONICAL_DIVISION_SLUG}" not found — seed divisions before syncing attribute lists`,
    );
  }
  const scope = { divisionId: division.id, segment: CANONICAL_SEGMENT };

  const result: SyncAttributeListsResult = {
    attributesUpserted: 0,
    optionsUpserted: 0,
    optionsDeactivated: 0,
    attributesDeleted: [],
    attributesDeactivated: [],
    slugsRenamed: [],
  };

  const findBySlug = (slug: string) =>
    prisma.materialAttribute.findUnique({
      where: { divisionId_segment_slug: { ...scope, slug } },
    });

  for (const [fromSlug, toSlug] of Object.entries(ATTRIBUTE_SLUG_RENAMES)) {
    const existing = await findBySlug(fromSlug);
    if (!existing) continue;
    const conflict = await findBySlug(toSlug);
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
    const attr = await findBySlug(slug);
    if (!attr) continue;
    await hardDeleteAttribute(prisma, attr.id);
    result.attributesDeleted.push(slug);
  }

  for (const slug of ATTRIBUTE_SLUGS_TO_DEACTIVATE) {
    const attr = await findBySlug(slug);
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
      where: { divisionId_segment_slug: { ...scope, slug: def.slug } },
      create: {
        ...scope,
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
  console.log("Syncing attribute lists (IS-Commercial scope)…");
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
