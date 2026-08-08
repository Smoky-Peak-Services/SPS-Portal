import { isValidUsNational10, parseUsPhone } from "@/lib/phone-parse";

/** Last 10 digits — format-agnostic phone match key. */
export function phoneLast10(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw.replace(/\D/g, "").slice(-10);
}

export type PhoneEventGroupFields = {
  id: string;
  partyNat: string | null;
  fromE164: string | null;
  toE164?: string | null;
  direction?: string;
};

function validatedPartyNat(partyNat: string | null): string | null {
  if (partyNat && isValidUsNational10(partyNat)) return partyNat;
  return null;
}

/** External party E.164 based on call direction. */
export function externalPartyE164(
  e: Pick<PhoneEventGroupFields, "direction" | "fromE164" | "toE164">,
): string | null {
  const incoming = (e.direction ?? "incoming") === "incoming";
  const raw = incoming ? e.fromE164 : (e.toE164 ?? null);
  return parseUsPhone(raw)?.e164 ?? null;
}

/** Group key for call-log rows — must match between list and dismiss. */
export function phoneEventGroupKey(e: PhoneEventGroupFields): string {
  const nat = validatedPartyNat(e.partyNat);
  if (nat) return nat;

  const extParsed = parseUsPhone(externalPartyE164(e));
  if (extParsed) return extParsed.national10;

  const fromNat = phoneLast10(e.fromE164);
  if (fromNat.length === 10 && isValidUsNational10(fromNat)) return fromNat;

  return e.id;
}

/** Prisma where clause to dismiss every event in a call-log group. */
export function dismissWhereForGroupKey(groupKey: string): {
  dismissed: false;
  id?: string;
  OR?: Array<
    | { partyNat: string }
    | { fromE164: { endsWith: string } }
    | { toE164: { endsWith: string } }
  >;
} {
  if (/^\d{10}$/.test(groupKey) && isValidUsNational10(groupKey)) {
    return {
      dismissed: false,
      OR: [
        { partyNat: groupKey },
        { fromE164: { endsWith: groupKey } },
        { toE164: { endsWith: groupKey } },
      ],
    };
  }
  return { id: groupKey, dismissed: false };
}
