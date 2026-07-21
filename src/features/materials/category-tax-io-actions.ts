"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  assertImportExport,
  requireMaterialsAccess,
} from "@/features/materials/authz";
import { userCan } from "@/config/permissions";
import {
  parseCategoryTaxWorkbookBuffer,
  planCategoryTaxImport,
  summarizeCategoryTaxPlan,
  type CategoryTaxImportPlan,
  type ExistingCategoryTaxSnapshot,
} from "./category-tax-io";
import { deriveTaxProfileFromStripeCode } from "./tax";

const PATHS = [
  "/materials",
  "/materials/categories",
  "/materials/import-export",
] as const;

function revalidateCategoryTaxIo() {
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

async function loadExistingCategoryTaxSnapshot(): Promise<ExistingCategoryTaxSnapshot> {
  const [categories, taxCodes] = await Promise.all([
    prisma.materialCategory.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        taxProfile: true,
        taxReviewed: true,
        stripeTaxCodeId: true,
        laborInstallTaxCodeId: true,
        laborServiceTaxCodeId: true,
        domain: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
      orderBy: [{ domain: { name: "asc" } }, { name: "asc" }],
    }),
    prisma.stripeTaxCode.findMany({ select: { id: true } }),
  ]);

  return {
    categories: categories.map((c) => ({
      id: c.id,
      domainId: c.domain.id,
      domainName: c.domain.name,
      domainSlug: c.domain.slug,
      name: c.name,
      slug: c.slug,
      taxProfile: c.taxProfile,
      taxReviewed: c.taxReviewed,
      stripeTaxCodeId: c.stripeTaxCodeId,
      laborInstallTaxCodeId: c.laborInstallTaxCodeId,
      laborServiceTaxCodeId: c.laborServiceTaxCodeId,
    })),
    validTaxCodeIds: new Set(taxCodes.map((t) => t.id)),
  };
}

export type CategoryTaxImportPreview = {
  filename: string;
  summary: ReturnType<typeof summarizeCategoryTaxPlan>;
  plan: CategoryTaxImportPlan;
};

async function buildPreview(
  formData: FormData,
): Promise<CategoryTaxImportPreview> {
  const user = await requireMaterialsAccess();
  assertImportExport(user);
  const { buffer, filename } = await readFileBuffer(formData);
  const parsed = await parseCategoryTaxWorkbookBuffer(buffer);
  const existing = await loadExistingCategoryTaxSnapshot();
  const plan = planCategoryTaxImport(existing, parsed);
  return {
    filename,
    summary: summarizeCategoryTaxPlan(plan),
    plan,
  };
}

export async function previewCategoryTaxImport(
  formData: FormData,
): Promise<CategoryTaxImportPreview> {
  return buildPreview(formData);
}

export type CategoryTaxImportCommitResult = {
  summary: ReturnType<typeof summarizeCategoryTaxPlan>;
  applied: { categoriesUpdated: number };
};

export async function commitCategoryTaxImport(
  formData: FormData,
): Promise<CategoryTaxImportCommitResult> {
  const user = await requireMaterialsAccess();
  assertImportExport(user);
  if (!userCan(user, "materials.force_delete")) {
    throw new Error(
      "Only users with force-delete permission can commit category tax imports",
    );
  }

  const preview = await buildPreview(formData);
  if (!preview.plan.layoutOk) {
    throw new Error(
      preview.plan.layoutMessage ??
        "This file doesn't look like a categories tax export.",
    );
  }

  const { plan } = preview;

  const applied = await prisma.$transaction(async (tx) => {
    let categoriesUpdated = 0;
    for (const u of plan.updates) {
      const data: {
        taxReviewed?: boolean;
        stripeTaxCodeId?: string | null;
        laborInstallTaxCodeId?: string | null;
        laborServiceTaxCodeId?: string | null;
        taxProfile?: ReturnType<typeof deriveTaxProfileFromStripeCode>;
      } = {};

      if (u.taxReviewed !== undefined) data.taxReviewed = u.taxReviewed;
      if (u.stripeTaxCodeId !== undefined) {
        data.stripeTaxCodeId = u.stripeTaxCodeId;
        data.taxProfile = deriveTaxProfileFromStripeCode(u.stripeTaxCodeId);
      } else if (u.taxProfile !== undefined) {
        data.taxProfile = u.taxProfile;
      }
      if (u.laborInstallTaxCodeId !== undefined) {
        data.laborInstallTaxCodeId = u.laborInstallTaxCodeId;
      }
      if (u.laborServiceTaxCodeId !== undefined) {
        data.laborServiceTaxCodeId = u.laborServiceTaxCodeId;
      }

      if (Object.keys(data).length === 0) continue;

      await tx.materialCategory.update({
        where: { id: u.id },
        data,
      });
      categoriesUpdated += 1;
    }
    return { categoriesUpdated };
  });

  revalidateCategoryTaxIo();
  return { summary: preview.summary, applied };
}
