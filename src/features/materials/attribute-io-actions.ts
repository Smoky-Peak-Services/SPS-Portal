"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireArea } from "@/lib/session";
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

async function loadExistingAttributeSnapshot(): Promise<ExistingAttributeSnapshot> {
  const attributes = await prisma.materialAttribute.findMany({
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
  summary: ReturnType<typeof summarizeAttributePlan>;
  plan: AttributeImportPlan;
};

async function buildPreview(
  formData: FormData,
): Promise<AttributeListsImportPreview> {
  await requireArea("materials");
  const { buffer, filename } = await readFileBuffer(formData);
  const parsed = await parseAttributeWorkbookBuffer(buffer);
  const existing = await loadExistingAttributeSnapshot();
  const plan = planAttributeImport(existing, parsed);
  return {
    filename,
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
  const user = await requireArea("materials");
  if (user.role !== "admin") {
    throw new Error("Only admins can commit attribute list imports");
  }

  const preview = await buildPreview(formData);
  if (!preview.plan.layoutOk) {
    throw new Error(
      preview.plan.layoutMessage ??
        "This file doesn't look like an attribute-lists export.",
    );
  }

  const { plan } = preview;

  const applied = await prisma.$transaction(async (tx) => {
    const attrIdBySlug = new Map<string, string>();
    const existing = await tx.materialAttribute.findMany({
      select: { id: true, slug: true },
    });
    for (const a of existing) {
      attrIdBySlug.set(a.slug.toLowerCase(), a.id);
    }

    let attributesCreated = 0;
    for (const a of plan.attributeCreates) {
      const created = await tx.materialAttribute.create({
        data: {
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
