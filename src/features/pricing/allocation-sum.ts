/**
 * Write-time INSTALL allocation invariant (prompt 25).
 * Engine Zod still validates at read time; this catches bad admin saves earlier.
 */

export const INSTALL_ALLOCATION_EPSILON = 0.01;

export type AllocRow = {
  id: string;
  context: "INSTALL" | "SERVICE" | string;
  quotedAllocationPct: number;
};

/**
 * After applying `updated` over matching id, do INSTALL rows sum to 100
 * within Decimal(5,2) epsilon?
 */
export function installAllocationSumOk(
  rows: AllocRow[],
  updated: { id: string; quotedAllocationPct: number },
  epsilon = INSTALL_ALLOCATION_EPSILON,
): { ok: true; sum: number } | { ok: false; sum: number } {
  let sum = 0;
  for (const row of rows) {
    if (row.context !== "INSTALL") continue;
    const pct =
      row.id === updated.id
        ? updated.quotedAllocationPct
        : row.quotedAllocationPct;
    sum += pct;
  }
  // Round to 2 dp to match Decimal(5,2) storage noise.
  const rounded = Math.round(sum * 100) / 100;
  if (Math.abs(rounded - 100) > epsilon) {
    return { ok: false, sum: rounded };
  }
  return { ok: true, sum: rounded };
}

export function installAllocationTotal(rows: AllocRow[]): number {
  let sum = 0;
  for (const row of rows) {
    if (row.context !== "INSTALL") continue;
    sum += row.quotedAllocationPct;
  }
  return Math.round(sum * 100) / 100;
}
