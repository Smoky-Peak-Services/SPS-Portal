/** Pure phone parsing — safe for client and server bundles (no Node built-ins). */

const QUO_RESOURCE_ID_RE = /^(US|PN|AC|CN|EV|CT|RE|VM|MG)[A-Za-z0-9]+$/;
const E164_RE = /^\+[1-9]\d{1,14}$/;
const NANP_RE = /^[2-9]\d{2}[2-9]\d{6}$/;

/** Quo/OpenPhone internal resource id (not a phone number). */
export function isQuoResourceId(raw: string | null | undefined): boolean {
  if (!raw) return false;
  return QUO_RESOURCE_ID_RE.test(raw.trim());
}

/** Valid US national 10-digit number (NANP area code + exchange rules). */
export function isValidUsNational10(digits: string): boolean {
  return NANP_RE.test(digits);
}

export type ParsedUsPhone = { e164: string; national10: string };

/**
 * Parse a US phone from E.164 or 10/11-digit input.
 * Returns null for Quo resource ids and numbers that fail NANP validation.
 */
export function parseUsPhone(
  raw: string | null | undefined,
): ParsedUsPhone | null {
  if (!raw) return null;
  const t = raw.trim();
  if (!t || isQuoResourceId(t)) return null;

  if (E164_RE.test(t)) {
    const digits = t.slice(1);
    if (digits.length === 11 && digits.startsWith("1")) {
      const national10 = digits.slice(1);
      if (isValidUsNational10(national10)) return { e164: t, national10 };
    }
    return null;
  }

  const digits = t.replace(/\D/g, "");
  if (digits.length === 10 && isValidUsNational10(digits)) {
    return { e164: `+1${digits}`, national10: digits };
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    const national10 = digits.slice(1);
    if (isValidUsNational10(national10))
      return { e164: `+${digits}`, national10 };
  }
  return null;
}

/** Normalize a US phone to E.164 (+1XXXXXXXXXX). Returns null if it can't. */
export function toE164(raw: string | null | undefined): string | null {
  return parseUsPhone(raw)?.e164 ?? null;
}

/**
 * What we persist. Prefer E.164 so match keys are consistent, but never drop
 * a number we can't parse — keep the trimmed input.
 */
export function phoneForStorage(raw: string | null | undefined): string | null {
  const t = (raw ?? "").trim();
  if (!t) return null;
  return toE164(t) ?? t;
}

/** Last 10 digits of a valid US number — null for Quo ids and invalid numbers. */
export function phoneNational(raw: string | null | undefined): string | null {
  return parseUsPhone(raw)?.national10 ?? null;
}

/**
 * Last-10 NANP digits from a US phone string (formatted or E.164).
 * Used for Contact.directPhoneNat / Lead.phoneNat (match index).
 * Accepts "(865) 555-1234"; refuses longer international digit strings so
 * last-10 of +49… cannot alias a Miami NANP number.
 */
export function phoneNat10(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const parsed = parseUsPhone(raw);
  if (parsed) return parsed.national10;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10 && isValidUsNational10(digits)) return digits;
  if (digits.length === 11 && digits.startsWith("1")) {
    const national10 = digits.slice(1);
    return isValidUsNational10(national10) ? national10 : null;
  }
  return null;
}
