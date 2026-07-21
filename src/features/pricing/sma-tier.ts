/**
 * SMA base-tier selection (prompt 11) — shared by Zod + engine (no circular imports).
 *
 * Bounds (exact edge → lower tier):
 * TR1 [500, 5000], TR2 (5000, 10000], TR3 (10000, 18000],
 * TR4 (18000, 30000], TR5 (30000, ∞). Below $500 → none.
 */
export type SmaTierBounds = {
  sku: string;
  feeType: "SMA_BASE_TIER";
  systemValueMin: number | null;
  systemValueMax: number | null;
};

export function selectSmaBaseTier<T extends SmaTierBounds>(
  systemMaterialValue: number,
  tiers: T[],
): T | null {
  if (!Number.isFinite(systemMaterialValue)) return null;

  const sorted = [...tiers]
    .filter((t) => t.feeType === "SMA_BASE_TIER")
    .sort(
      (a, b) =>
        (a.systemValueMin ?? Number.POSITIVE_INFINITY) -
        (b.systemValueMin ?? Number.POSITIVE_INFINITY),
    );

  for (let i = 0; i < sorted.length; i++) {
    const tier = sorted[i]!;
    const min = tier.systemValueMin;
    if (min == null) continue;
    const max =
      tier.systemValueMax == null
        ? Number.POSITIVE_INFINITY
        : tier.systemValueMax;
    const inRange =
      i === 0
        ? systemMaterialValue >= min && systemMaterialValue <= max
        : systemMaterialValue > min && systemMaterialValue <= max;
    if (inRange) return tier;
  }
  return null;
}
