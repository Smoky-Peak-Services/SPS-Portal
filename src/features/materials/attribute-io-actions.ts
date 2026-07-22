"use server";

import { revalidatePath } from "next/cache";
import type { Segment } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  assertImportExport,
  requireMaterialsAccess,
} from "@/features/materials/authz";
import { userCan } from "@/config/permissions";
import { resolveScope } from "./scope";
import {
  parseAttributeWorkbookBuffer,
  planAttributeImport,
  summarizeAttributePlan,
  type AttributeImportPlan,
  type ExistingAttributeSnapshot,
} from "./attribute-io";

const PATHS = [
  "/materials",
  "/materials/attributes",
  "/materials/import-export",
  "/materials/categories",
] as const;

function revalidateAttributeIo() {
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

/** Attributes are per-scope (prompt 14): every IO round-trip targets one scope. */
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
  const resolved = resolveScope(division.slug, segmentRaw);
  return {
    divisionId,
    segment: resolved.segment,
    scopeCode: resolved.scopeCode,
  };
}

async function loadExistingAttributeSnapshot(
  divisionId: string,
  segment: Segment,
): Promise<ExistingAttributeSnapshot> {
  const attributes = await prisma.materialAttribute.findMany({
    where: { divisionId, segment },
    select: {
      id: true,
      slug: true,
      name: true,
      options: {
        select: {
          id: true,
          attributeId: true,
          value: true,
          label: true,
          sortOrder: true,
        },
      },
    },
  });
  return { attributes };
}

export type AttributeListsImportPreview = {
  filename: string;
  divisionId: string;
  segment: Segment;
  scopeCode: string;
  summary: ReturnType<typeof summarizeAttributePlan>;
  plan: AttributeImportPlan;
};

async function buildPreview(
  formData: FormData,
): Promise<AttributeListsImportPreview> {
  const user = await requireMaterialsAccess();
  assertImportExport(user);
  const { buffer, filename } = await readFileBuffer(formData);
  const scope = await readScope(formData);
  const parsed = await parseAttributeWorkbookBuffer(buffer);
  const existing = await loadExistingAttributeSnapshot(
    scope.divisionId,
    scope.segment,
  );
  const plan = planAttributeImport(existing, parsed);
  return {
    filename,
    divisionId: scope.divisionId,
    segment: scope.segment,
    scopeCode: scope.scopeCode,
    summary: summarizeAttributePlan(plan),
    plan,
  };
}

export async function previewAttributeListsImport(
  formData: FormData,
): Promise<AttributeListsImportPreview> {
  return buildPreview(formData);
}

export type AttributeListsImportCommitResult = {
  summary: ReturnType<typeof summarizeAttributePlan>;
  applied: {
    attributesCreated: number;
    attributesUpdated: number;
    optionsCreated: number;
    optionsUpdated: number;
  };
};

export async function commitAttributeListsImport(
  formData: FormData,
): Promise<AttributeListsImportCommitResult> {
  const user = await requireMaterialsAccess();
  assertImportExport(user);
  if (!userCan(user, "materials.force_delete")) {
    throw new Error(
      "Only users with force-delete permission can commit attribute list imports",
    );
  }

  const preview = await buildPreview(formData);
  if (!preview.plan.layoutOk) {
    throw new Error(
      preview.plan.layoutMessage ??
        "This file doesn't look like an attribute-lists export.",
    );
  }

  const { plan, divisionId, segment } = preview;

  const applied = await prisma.$transaction(async (tx) => {
    const attrIdBySlug = new Map<string, string>();
    const existing = await tx.materialAttribute.findMany({
      where: { divisionId, segment },
      select: { id: true, slug: true },
    });
    for (const a of existing) {
      attrIdBySlug.set(a.slug.toLowerCase(), a.id);
    }

    let attributesCreated = 0;
    for (const a of plan.attributeCreates) {
      const created = await tx.materialAttribute.create({
        data: {
          divisionId,
          segment,
          slug: a.slug,
          name: a.name,
          inputType: "SELECT",
        },
      });
      attrIdBySlug.set(a.slug.toLowerCase(), created.id);
      attributesCreated += 1;
    }

    let attributesUpdated = 0;
    for (const a of plan.attributeUpdates) {
      await tx.materialAttribute.update({
        where: { id: a.id },
        data: { name: a.name },
      });
      attributesUpdated += 1;
    }

    async function resolveAttrId(slug: string): Promise<string> {
      const id = attrIdBySlug.get(slug.toLowerCase());
      if (!id) throw new Error(`Missing attribute for slug ${slug}`);
      return id;
    }

    let optionsCreated = 0;
    for (const o of plan.optionCreates) {
      const attributeId = await resolveAttrId(o.attributeSlug);
      await tx.materialAttributeOption.create({
        data: {
          attributeId,
          value: o.value,
          label: o.label,
          sortOrder: o.sortOrder,
        },
      });
      optionsCreated += 1;
    }

    let optionsUpdated = 0;
    for (const o of plan.optionUpdates) {
      await tx.materialAttributeOption.update({
        where: { id: o.id },
        data: {
          label: o.label,
          sortOrder: o.sortOrder,
        },
      });
      optionsUpdated += 1;
    }

    return {
      attributesCreated,
      attributesUpdated,
      optionsCreated,
      optionsUpdated,
    };
  });

  revalidateAttributeIo();
  return { summary: preview.summary, applied };
}
