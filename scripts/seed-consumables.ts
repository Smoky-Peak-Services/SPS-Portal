import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";

type SeedRow = {
  description: string;
  sku: string;
  category: string | null;
  manufacturer: string | null;
  partNumber: string | null;
  unit: string;
  wasteFactorPct: number;
  baseCost: number | null;
  isMarketRate: boolean;
  markupPct: number;
  laborUnits: number;
  supplier: string | null;
  sortOrder: number;
};

function parseMoney(raw: string): number | null | "MARKET" {
  const s = raw.trim();
  if (!s) return null;
  if (/^mrkt\s*rate$/i.test(s)) return "MARKET";
  const n = Number(s.replace(/[$,]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function parsePct(raw: string): number {
  const s = raw.trim().replace(/%/g, "");
  if (!s) return 0;
  const n = Number(s);
  if (!Number.isFinite(n)) return 0;
  // Sheet uses 10.0% or 50.0% — store as decimal.
  return n > 1 ? n / 100 : n;
}

/** Minimal CSV splitter that respects quoted fields. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function parseIsConsumables(csvPath: string): SeedRow[] {
  const text = readFileSync(csvPath, "utf8");
  const lines = text.split(/\r?\n/);
  const headerIdx = lines.findIndex((l) =>
    l.startsWith("Item Description,SKU,Category"),
  );
  if (headerIdx < 0) throw new Error("IS consumables header not found");
  const rows: SeedRow[] = [];
  let sort = 0;
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line || line.startsWith("Notes") || line.startsWith(",")) break;
    const cols = splitCsvLine(line);
    if (cols.length < 8) continue;
    const description = cols[0]!.trim();
    const sku = cols[1]!.trim();
    if (!description || !sku) continue;
    const cost = parseMoney(cols[5] ?? "");
    rows.push({
      description,
      sku,
      category: cols[2]!.trim() || null,
      manufacturer: null,
      partNumber: null,
      unit: cols[3]!.trim() || "Each",
      wasteFactorPct: parsePct(cols[4] ?? "0"),
      baseCost: cost === "MARKET" ? null : cost,
      isMarketRate: cost === "MARKET",
      markupPct: parsePct(cols[6] ?? "50"),
      laborUnits: 0,
      supplier: cols[8]?.trim() || null,
      sortOrder: sort++,
    });
  }
  return rows;
}

function parseCabinConsumables(csvPath: string): SeedRow[] {
  const text = readFileSync(csvPath, "utf8");
  const lines = text.split(/\r?\n/);
  const headerIdx = lines.findIndex((l) =>
    l.startsWith("Product Description,Manufacturer,Part Number"),
  );
  if (headerIdx < 0) throw new Error("Cabin consumables header not found");
  const rows: SeedRow[] = [];
  let sort = 0;
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line || line.startsWith("Notes") || line.startsWith(",")) break;
    const cols = splitCsvLine(line);
    if (cols.length < 9) continue;
    const description = cols[0]!.trim();
    const sku = cols[3]!.trim();
    if (!description || !sku) continue;
    const cost = parseMoney(cols[6] ?? "");
    const sale = parseMoney(cols[7] ?? "");
    const isMarket = cost === "MARKET" || sale === "MARKET";
    const baseCost = isMarket ? null : cost;
    // Cabin default markup 30%; derive from sale/cost when both look sane.
    let markupPct = 0.3;
    if (
      !isMarket &&
      typeof cost === "number" &&
      typeof sale === "number" &&
      cost > 0
    ) {
      const derived = Math.round((sale / cost - 1) * 10000) / 10000;
      if (derived >= 0 && derived <= 2) markupPct = derived;
    }
    rows.push({
      description,
      sku,
      category: null,
      manufacturer: cols[1]!.trim() || null,
      partNumber: cols[2]!.trim() || null,
      unit: cols[5]!.trim() || "EACH",
      wasteFactorPct: parsePct(cols[4] ?? "0"),
      baseCost,
      isMarketRate: isMarket,
      markupPct,
      laborUnits: Number(cols[8]!.trim() || 0) || 0,
      supplier: null,
      sortOrder: sort++,
    });
  }
  return rows;
}

async function upsertDivisionRows(
  prisma: PrismaClient,
  divisionSlug: string,
  rows: SeedRow[],
) {
  const division = await prisma.division.findUnique({
    where: { slug: divisionSlug },
    select: { id: true },
  });
  if (!division) {
    throw new Error(
      `Division "${divisionSlug}" not found — seed divisions first`,
    );
  }

  for (const row of rows) {
    const data = {
      description: row.description,
      category: row.category,
      manufacturer: row.manufacturer,
      partNumber: row.partNumber,
      unit: row.unit,
      wasteFactorPct: new Prisma.Decimal(row.wasteFactorPct),
      baseCost: row.baseCost == null ? null : new Prisma.Decimal(row.baseCost),
      isMarketRate: row.isMarketRate,
      markupPct: new Prisma.Decimal(row.markupPct),
      laborUnits: new Prisma.Decimal(row.laborUnits),
      supplier: row.supplier,
      isActive: true,
      sortOrder: row.sortOrder,
    };
    await prisma.consumableItem.upsert({
      where: {
        divisionId_sku: { divisionId: division.id, sku: row.sku },
      },
      create: {
        divisionId: division.id,
        sku: row.sku,
        ...data,
      },
      update: data,
    });
  }
}

/**
 * Seed division-scoped consumables from the prompt 17 CSV fixtures.
 */
export async function seedConsumables(prisma: PrismaClient): Promise<void> {
  const samples = resolve(process.cwd(), "claude/prompts/samples");
  const isRows = parseIsConsumables(resolve(samples, "is-consumables.csv"));
  const cabinRows = parseCabinConsumables(
    resolve(samples, "cabin-consumables.csv"),
  );

  console.log(
    `  Consumables: IS ${isRows.length} rows, Cabin ${cabinRows.length} rows`,
  );

  await upsertDivisionRows(prisma, "integrated-systems", isRows);
  await upsertDivisionRows(prisma, "cabin-services", cabinRows);
}
