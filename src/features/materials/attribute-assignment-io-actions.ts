"use server";

import { revalidatePath } from "next/cache";
import type { Segment } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  assertImportExport,
  requireMaterialsAccess,
} from "@/features/materials/authz";
import { userCan } from "@/config/permissions";
import { resolveStorageScope } from "./scope";
import {
  parseAssignmentWorkbookBuffer,
  planAssignmentImport,
  summarizeAssignmentPlan,
  type AssignmentImportPlan,
  type ExistingAssignmentSnapshot,
} from "./attribute-assignment-io";

const PATHS = [
  "/materials",
  "/materials/attributes",
  "/materials/categories",
  "/materials/import-export",
] as const;

function revalidateAssignmentIo() {
  for (const p of PATHS) revalidatePath(p);
}

async function readFileBuffer(formData: FormData): Promise<{
  buffer: Buffer;
  filename: string;
}> {
  const file = formData.get("file");
  if (!(file instanceof File)) {
    throw new Error("Missing file upload");
  }
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    throw new Error("File must be a .xlsx workbook");
  }
  const ab = await file.arrayBuffer();
  return { buffer: Buffer.from(ab), filename: file.name };
}

/** Attributes and assignments are per-scope (prompt 14). */
async function readScope(formData: FormData): Promise<{
  divisionId: string;
  segment: Segment;
  scopeCode: string;
}> {
  const divisionId = String(formData.get("divisionId") ?? "").trim();
  const segmentRaw = String(formData.get("segment") ?? "").trim();
  if (!divisionId) throw new Error("Missing divisionId");
  const division = await prisma.division.findUnique({
    where: { id: divisionId },
    select: { slug: true },
  });
  if (!division) throw new Error("Division not found");
  const resolved = resolveStorageScope(division.slug, segmentRaw);
  return {
    divisionId,
    segment: resolved.storageSegment,
    scopeCode: resolved.scopeCode,
  };
}

async function loadExistingAssignmentSnapshot(
  divisionId: string,
  segment: Segment,
): Promise<ExistingAssignmentSnapshot> {
  const [categories, attributes, assignments] = await Promise.all([
    prisma.materialCategory.findMany({
      where: { domain: { divisionId, segment } },
      select: {
        id: true,
        name: true,
        slug: true,
        domain: { select: { name: true, slug: true } },
      },
    }),
    prisma.materialAttribute.findMany({
      where: { divisionId, segment },
      select: {
        id: true,
        name: true,
        slug: true,
        options: { select: { id: true, label: true } },
      },
    }),
    prisma.materialAttributeAssignment.findMany({
      where: { category: { domain: { divisionId, segment } } },
      select: {
        id: true,
        categoryId: true,
        attributeId: true,
        isRequired: true,
        isFilterable: true,
        isVariantDefining: true,
        defaultOptionId: true,
        sortOrder: true,
        defaultOption: { select: { label: true } },
      },
    }),
  ]);

  return {
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      domainName: c.domain.name,
      domainSlug: c.domain.slug,
    })),
    attributes,
    assignments: assignments.map((a) => ({
      id: a.id,
      categoryId: a.categoryId,
      attributeId: a.attributeId,
      isRequired: a.isRequired,
      isFilterable: a.isFilterable,
      isVariantDefining: a.isVariantDefining,
      defaultOptionId: a.defaultOptionId,
      defaultOptionLabel: a.defaultOption?.label ?? null,
      sortOrder: a.sortOrder,
    })),
  };
}

export type AssignmentImportPreview = {
  filename: string;
  divisionId: string;
  segment: Segment;
  scopeCode: string;
  summary: ReturnType<typeof summarizeAssignmentPlan>;
  plan: AssignmentImportPlan;
};

async function buildPreview(
  formData: FormData,
): Promise<AssignmentImportPreview> {
  const user = await requireMaterialsAccess();
  assertImportExport(user);
  const { buffer, filename } = await readFileBuffer(formData);
  const scope = await readScope(formData);
  const parsed = await parseAssignmentWorkbookBuffer(buffer);
  const existing = await loadExistingAssignmentSnapshot(
    scope.divisionId,
    scope.segment,
  );
  const plan = planAssignmentImport(existing, parsed);
  return {
    filename,
    divisionId: scope.divisionId,
    segment: scope.segment,
    scopeCode: scope.scopeCode,
    summary: summarizeAssignmentPlan(plan),
    plan,
  };
}

export async function previewAssignmentImport(
  formData: FormData,
): Promise<AssignmentImportPreview> {
  return buildPreview(formData);
}

export type AssignmentImportCommitResult = {
  summary: ReturnType<typeof summarizeAssignmentPlan>;
  applied: { created: number; updated: number };
};

export async function commitAssignmentImport(
  formData: FormData,
): Promise<AssignmentImportCommitResult> {
  const user = await requireMaterialsAccess();
  assertImportExport(user);
  if (!userCan(user, "materials.force_delete")) {
    throw new Error(
      "Only users with force-delete permission can commit assignment imports",
    );
  }

  const preview = await buildPreview(formData);
  if (!preview.plan.layoutOk) {
    throw new Error(
      preview.plan.layoutMessage ??
        "This file doesn't look like an attribute-assignments export.",
    );
  }

  const { plan } = preview;

  const applied = await prisma.$transaction(async (tx) => {
    let created = 0;
    for (const c of plan.creates) {
      await tx.materialAttributeAssignment.create({
        data: {
          categoryId: c.categoryId,
          attributeId: c.attributeId,
          isRequired: c.isRequired,
          isFilterable: c.isFilterable,
          isVariantDefining: c.isVariantDefining,
          defaultOptionId: c.defaultOptionId,
          sortOrder: c.sortOrder,
        },
      });
      created += 1;
    }

    let updated = 0;
    for (const u of plan.updates) {
      await tx.materialAttributeAssignment.update({
        where: { id: u.id },
        data: {
          ...(u.isRequired !== undefined ? { isRequired: u.isRequired } : {}),
          ...(u.isFilterable !== undefined
            ? { isFilterable: u.isFilterable }
            : {}),
          ...(u.isVariantDefining !== undefined
            ? { isVariantDefining: u.isVariantDefining }
            : {}),
          ...(u.defaultOptionId !== undefined
            ? { defaultOptionId: u.defaultOptionId }
            : {}),
          ...(u.sortOrder !== undefined ? { sortOrder: u.sortOrder } : {}),
        },
      });
      updated += 1;
    }

    return { created, updated };
  });

  revalidateAssignmentIo();
  return { summary: preview.summary, applied };
}
