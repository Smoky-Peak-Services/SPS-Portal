import { isValidUsNational10, parseUsPhone } from "@/lib/phone-parse";

/**
 * Format a stored phone value (E.164 or raw) for display as (123) 456-7890.
 * Only formats valid US NANP numbers; otherwise shows E.164 or "Unknown caller".
 */
export function formatPhoneDisplay(raw: string | null | undefined): string {
  if (!raw) return "Unknown caller";
  const parsed = parseUsPhone(raw);
  if (parsed) {
    const d = parsed.national10;
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  const d = raw.replace(/\D/g, "").slice(-10);
  if (d.length === 10 && isValidUsNational10(d)) {
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  const trimmed = raw.trim();
  if (trimmed.startsWith("+")) return trimmed;
  return "Unknown caller";
}
