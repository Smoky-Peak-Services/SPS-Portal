/**
 * Write-time SMA_BASE_TIER range overlap check (prompt 25).
 * Sorted by systemValueMin; adjacent tiers may touch (prev.max === next.min)
 * because selectSmaBaseTier uses [min,max] for the first tier and (min,max]
 * for later ones. Overlap when prev.max > next.min.
 */

export type TierRange = {
  id?: string;
  sku: string;
  systemValueMin: number | null;
  systemValueMax: number | null;
};

/**
 * Returns an error message if `candidate` overlaps any existing tier
 * (excluding candidate.id when updating).
 */
export function smaTierOverlapError(
  candidate: TierRange,
  existing: TierRange[],
): string | null {
  if (candidate.systemValueMin == null) {
    return `SMA base tier "${candidate.sku}" requires systemValueMin`;
  }

  const all = [...existing.filter((t) => t.id !== candidate.id), candidate].sort(
    (a, b) =>
      (a.systemValueMin ?? Number.POSITIVE_INFINITY) -
      (b.systemValueMin ?? Number.POSITIVE_INFINITY),
  );

  for (let i = 0; i < all.length - 1; i++) {
    const prev = all[i]!;
    const next = all[i + 1]!;
    if (prev.systemValueMin == null || next.systemValueMin == null) {
      return `SMA base tier "${prev.sku}" / "${next.sku}" missing systemValueMin`;
    }
    if (prev.systemValueMax == null) {
      return `SMA base tier "${prev.sku}" must have systemValueMax (only the highest tier may be open-ended)`;
    }
    if (prev.systemValueMax > next.systemValueMin) {
      return `SMA base tier "${candidate.sku}" overlaps another tier in this scope — adjust systemValueMin/Max`;
    }
  }
  return null;
}
