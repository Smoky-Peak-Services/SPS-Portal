"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  assertImportExport,
  requireMaterialsAccess,
} from "@/features/materials/authz";
import { userCan } from "@/config/permissions";
import {
  parseDomainFlatWorkbookBuffer,
  planDomainFlatImport,
  summarizeDomainFlatPlan,
  type DomainFlatImportPlan,
  type ExistingDomainSnapshot,
} from "./domain-io";

function revalidate() {
  for (const p of ["/materials", "/materials/domains", "/materials/import-export"]) {
    revalidatePath(p);
  }
}

async function readFileBuffer(formData: FormData): Promise<{
  buffer: Buffer;
  filename: string;
}> {
  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("Missing file upload");
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    throw new Error("File must be a .xlsx workbook");
  }
  return { buffer: Buffer.from(await file.arrayBuffer()), filename: file.name };
}

async function loadSnapshot(): Promise<ExistingDomainSnapshot> {
  const [domains, divisions] = await Promise.all([
    prisma.materialDomain.findMany({
      select: {
        id: true,
        divisionId: true,
        segment: true,
        name: true,
        slug: true,
        sortOrder: true,
        division: { select: { name: true, slug: true } },
      },
    }),
    prisma.division.findMany({
      select: { id: true, name: true, slug: true },
    }),
  ]);
  return {
    divisions,
    domains: domains.map((d) => ({
      id: d.id,
      divisionId: d.divisionId,
      divisionName: d.division.name,
      divisionSlug: d.division.slug,
      segment: d.segment,
      name: d.name,
      slug: d.slug,
      sortOrder: d.sortOrder,
    })),
  };
}

export type DomainFlatImportPreview = {
  filename: string;
  summary: ReturnType<typeof summarizeDomainFlatPlan>;
  plan: DomainFlatImportPlan;
};

async function buildPreview(formData: FormData): Promise<DomainFlatImportPreview> {
  const user = await requireMaterialsAccess();
  assertImportExport(user);
  const { buffer, filename } = await readFileBuffer(formData);
  const parsed = await parseDomainFlatWorkbookBuffer(buffer);
  const plan = planDomainFlatImport(await loadSnapshot(), parsed);
  return { filename, summary: summarizeDomainFlatPlan(plan), plan };
}

export async function previewDomainFlatImport(formData: FormData) {
  return buildPreview(formData);
}

export async function commitDomainFlatImport(formData: FormData) {
  const user = await requireMaterialsAccess();
  assertImportExport(user);
  if (!userCan(user, "materials.force_delete")) {
    throw new Error(
      "Only users with force-delete permission can commit domain imports",
    );
  }
  const preview = await buildPreview(formData);
  if (!preview.plan.layoutOk) {
    throw new Error(
      preview.plan.layoutMessage ?? "This file doesn't look like a domains export.",
    );
  }
  const { plan } = preview;
  const applied = await prisma.$transaction(async (tx) => {
    let created = 0;
    for (const c of plan.creates) {
      await tx.materialDomain.create({
        data: {
          divisionId: c.divisionId,
          segment: c.segment,
          name: c.name,
          slug: c.slug,
          sortOrder: c.sortOrder,
        },
      });
      created += 1;
    }
    let updated = 0;
    for (const u of plan.updates) {
      await tx.materialDomain.update({
        where: { id: u.id },
        data: {
          ...(u.name !== undefined ? { name: u.name } : {}),
          ...(u.sortOrder !== undefined ? { sortOrder: u.sortOrder } : {}),
        },
      });
      updated += 1;
    }
    return { created, updated };
  });
  revalidate();
  return { summary: preview.summary, applied };
}
