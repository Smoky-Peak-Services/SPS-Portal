/**
 * Seed StripeTaxCode from claude/prompts/samples/product_tax_codes.csv
 * and LaborTaxCodeDefault rows for install/service × REAL_PROPERTY/TPP.
 *
 * Per Ryan's classification (informed by SES v. Roberts) —
 * see claude/prompts/05-materials-tax-code-linkage.md
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { PrismaClient } from "@prisma/client";

const LABOR_DEFAULTS = [
  {
    taxProfile: "REAL_PROPERTY" as const,
    workContext: "INSTALL" as const,
    stripeTaxCodeId: "txcd_20020010",
  },
  {
    taxProfile: "REAL_PROPERTY" as const,
    workContext: "SERVICE" as const,
    stripeTaxCodeId: "txcd_20080007",
  },
  {
    taxProfile: "TPP" as const,
    workContext: "INSTALL" as const,
    stripeTaxCodeId: "txcd_20020018",
  },
  {
    taxProfile: "TPP" as const,
    workContext: "SERVICE" as const,
    stripeTaxCodeId: "txcd_20080005",
  },
];

/** Minimal RFC4180-ish CSV parse for the Stripe product tax codes export. */
export function parseProductTaxCodesCsv(raw: string): {
  id: string;
  type: string;
  performanceLocationRequirement: string;
  name: string;
  description: string;
}[] {
  const lines = raw
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((l) => l.length > 0);
  if (lines.length < 2) return [];

  function parseLine(line: string): string[] {
    const out: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]!;
      if (inQuotes) {
        if (ch === '"') {
          if (line[i + 1] === '"') {
            cur += '"';
            i += 1;
          } else {
            inQuotes = false;
          }
        } else {
          cur += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        out.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out;
  }

  const header = parseLine(lines[0]!).map((h) => h.trim().toLowerCase());
  const idx = {
    id: header.indexOf("id"),
    type: header.indexOf("type"),
    performanceLocationRequirement: header.indexOf(
      "performancelocationrequirement",
    ),
    name: header.indexOf("name"),
    description: header.indexOf("description"),
  };
  if (Object.values(idx).some((i) => i < 0)) {
    throw new Error("product_tax_codes.csv missing expected columns");
  }

  const rows = [];
  const seen = new Set<string>();
  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i]!);
    const id = (cols[idx.id] ?? "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    rows.push({
      id,
      type: (cols[idx.type] ?? "").trim(),
      performanceLocationRequirement: (
        cols[idx.performanceLocationRequirement] ?? ""
      ).trim(),
      name: (cols[idx.name] ?? "").trim(),
      description: (cols[idx.description] ?? "").trim(),
    });
  }
  return rows;
}

export async function seedStripeTaxCodes(
  prisma: PrismaClient,
): Promise<number> {
  const csvPath = join(
    process.cwd(),
    "claude/prompts/samples/product_tax_codes.csv",
  );
  const raw = readFileSync(csvPath, "utf8");
  const rows = parseProductTaxCodesCsv(raw);
  const now = new Date();

  // Batch upserts in chunks
  const chunkSize = 100;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    await prisma.$transaction(
      chunk.map((r) =>
        prisma.stripeTaxCode.upsert({
          where: { id: r.id },
          create: {
            id: r.id,
            name: r.name,
            description: r.description,
            type: r.type,
            performanceLocationRequirement: r.performanceLocationRequirement,
            updatedAt: now,
          },
          update: {
            name: r.name,
            description: r.description,
            type: r.type,
            performanceLocationRequirement: r.performanceLocationRequirement,
            updatedAt: now,
          },
        }),
      ),
    );
  }

  for (const d of LABOR_DEFAULTS) {
    const existing = await prisma.laborTaxCodeDefault.findUnique({
      where: {
        taxProfile_workContext: {
          taxProfile: d.taxProfile,
          workContext: d.workContext,
        },
      },
    });
    if (existing) {
      await prisma.laborTaxCodeDefault.update({
        where: { id: existing.id },
        data: { stripeTaxCodeId: d.stripeTaxCodeId },
      });
    } else {
      await prisma.laborTaxCodeDefault.create({
        data: {
          taxProfile: d.taxProfile,
          workContext: d.workContext,
          stripeTaxCodeId: d.stripeTaxCodeId,
        },
      });
    }
  }

  // Explicit TPP carve-outs when those category names already exist (no bulk flip).
  const tppNames = [
    "software",
    "licenses",
    "software and licenses",
    "patch cables",
    "servers",
    "workstations",
    "hard drives",
  ];
  const categories = await prisma.materialCategory.findMany({
    select: { id: true, name: true },
  });
  for (const c of categories) {
    const key = c.name.trim().toLowerCase();
    if (tppNames.includes(key)) {
      await prisma.materialCategory.update({
        where: { id: c.id },
        data: { taxProfile: "TPP" },
      });
    }
  }

  return rows.length;
}
