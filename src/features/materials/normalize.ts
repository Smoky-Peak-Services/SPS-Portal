import { slugify as slugifyBase } from "./slug";

/** Trim and collapse internal whitespace. Used for storage + matching. */
export function normalizeName(input: string): string {
  return input.trim().replace(/\s+/g, " ");
}

/** Case-insensitive match key for normalized names. */
export function nameMatchKey(input: string): string {
  return normalizeName(input).toLowerCase();
}

export function slugify(input: string): string {
  return slugifyBase(normalizeName(input));
}

export { slugifyBase };
