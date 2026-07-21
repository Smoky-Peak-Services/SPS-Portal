/**
 * Canonical material attributes (SELECT picklists + core TEXT attrs).
 * Synced to ops DB via `scripts/sync-attribute-lists.ts`.
 * Excel import remains additive; this file is the source of truth for full sync.
 */
import type { MaterialAttributeInputType } from "@prisma/client";
import { slugify } from "./slug";

export type AttributeOptionDef = {
  value: string;
  label: string;
  sortOrder: number;
};

export type AttributeListDef = {
  slug: string;
  name: string;
  /** Defaults to SELECT when omitted. */
  inputType?: MaterialAttributeInputType;
  options: AttributeOptionDef[];
};

/** Always assigned on every category; cannot be unassigned in the UI. */
export const CORE_CATEGORY_ATTRIBUTE_SLUGS = [
  "manufacturer",
  "part_number",
] as const;

export type CoreCategoryAttributeSlug =
  (typeof CORE_CATEGORY_ATTRIBUTE_SLUGS)[number];

export function isCoreCategoryAttributeSlug(
  slug: string,
): slug is CoreCategoryAttributeSlug {
  return (CORE_CATEGORY_ATTRIBUTE_SLUGS as readonly string[]).includes(slug);
}

function fromLabels(labels: string[]): AttributeOptionDef[] {
  return labels.map((label, i) => ({
    value: slugify(label),
    label,
    sortOrder: i,
  }));
}

function fromPairs(
  pairs: { value: string; label: string }[],
): AttributeOptionDef[] {
  return pairs.map((p, i) => ({ ...p, sortOrder: i }));
}

/** Existing manufacturer labels (59) — do not remove. */
export const MANUFACTURER_EXISTING = [
  "Generic - Default",
  "2N",
  "3M",
  "3xLogic",
  "ABB",
  "Adams Rite",
  "Alarm Controls",
  "Allegion",
  "Altronix",
  "ASSA ABLOY",
  "Axis Communications",
  "BEA",
  "Belden",
  "BEST",
  "Bosch",
  "Camden",
  "Chief",
  "Command Access",
  "CommScope",
  "Detex",
  "Don-Jo",
  "Eaton",
  "Fluke",
  "Genesis by Honeywell",
  "GRI",
  "Hanwha Vision (Wisenet)",
  "HES",
  "HID",
  "ICC",
  "Inovonics",
  "Keedex",
  "Keri Systems",
  "Legrand",
  "Leviton",
  "Life Safety Power",
  "Lockly USA",
  "Marks",
  "Nascom",
  "nVent CADDY",
  "Optex",
  "Panduit",
  "Peerless-AV",
  "Porter",
  "Primex",
  "Sargent",
  "Schlage",
  "SDC",
  "Secolarm",
  "Securitron",
  "Show Me Cables",
  "STI",
  "TRENDnet",
  "Ubiquiti",
  "Uniview",
  "Velcro",
  "Von Duprin",
  "WaveLynx",
  "West Penn Wire",
  "Windy City Wire",
] as const;

/** Appended structured cabling / CCTV / access-control brands. */
export const MANUFACTURER_APPEND = [
  "Superior Essex",
  "Berk-Tek",
  "Corning",
  "Molex",
  "Ortronics",
  "Hubbell Premise Wiring",
  "Siemon",
  "HellermannTyton",
  "Hikvision",
  "Dahua",
  "Avigilon",
  "Verkada",
  "Pelco",
  "Speco Technologies",
  "Digital Watchdog",
  "Genetec",
  "Milestone",
  "Brivo",
  "Openpath",
  "Salto",
  "Paxton",
  "Aiphone",
  "ButterflyMX",
  "Alarm.com",
  "Resideo",
  "DSC",
  "LenelS2",
] as const;

/** Unchanged pathways attachment types from prior fixture. */
const ATTACHMENT_TYPE_PATHWAYS = [
  "Bat Wing Drop Wire Clip",
  'Bang-On 1/8" Flange',
  'Bang-On Swivel 1/8" Flange',
  'Bang-On 1/4" Flange',
  "Fixed Beam Clamp",
  "Swivel Beam Clamp",
  'Bang-On Swivel 1/4" Flange',
  "Screw-In Rod Hanger - Wood",
  "Screw-In Rod Hanger - Metal",
  "Tapcon Rod Hanger",
  "Powder Actuated Shots",
  "Drop-In Anchor",
  "Eyelet Lag - Wood",
  "Eyelet Lag - Metal",
] as const;

const POE_CLASS_OPTIONS = fromPairs([
  {
    value: "poe-type-1",
    label:
      "PoE (Type 1) — Spec: 802.3af | Max Power: 15.4 W | Delivered: 12.95 W | Typical: VoIP phones, basic IP cameras, sensors",
  },
  {
    value: "poe-type-2",
    label:
      "PoE+ (Type 2) — Spec: 802.3at | Max Power: 30.0 W | Delivered: 25.5 W | Typical: Wireless access points, PTZ cameras",
  },
  {
    value: "poe-type-3",
    label:
      "PoE++ (Type 3) — Spec: 802.3bt | Max Power: 60.0 W | Delivered: 51.0 W | Typical: Building lighting, dual-hub access points",
  },
  {
    value: "poe-type-4",
    label:
      "PoE++ (Type 4) — Spec: 802.3bt | Max Power: 90–100 W | Delivered: 71–95 W | Typical: Laptops, TVs, high-power industrial devices",
  },
]);

/**
 * Canonical active attribute lists (synced to DB).
 * Order is stable for Excel index sheet generation.
 */
export const CANONICAL_ATTRIBUTE_LISTS: AttributeListDef[] = [
  {
    slug: "attachment_type_pathways",
    name: "Attachment Type (Pathways)",
    options: fromLabels([...ATTACHMENT_TYPE_PATHWAYS]),
  },
  {
    slug: "box_length",
    name: "Box Length",
    options: fromLabels(["250'", "500'", "1000'", "1250'", "1500'", "2000'"]),
  },
  {
    slug: "patch_cable_length",
    name: "Patch Cable Length",
    options: fromLabels([
      "1'",
      "2'",
      "3'",
      "5'",
      "7'",
      "10'",
      "12'",
      "14'",
      "16'",
      "18'",
      "20'",
      "22'",
      "24'",
      "25'",
      "26'",
      "28'",
      "30'",
      "32'",
      "35'",
    ]),
  },
  {
    slug: "jacket_color",
    name: "Jacket Color",
    options: fromLabels([
      "Blue",
      "White",
      "Gray",
      "Yellow",
      "Green",
      "Red",
      "Orange",
      "Purple",
      "Black",
      "Pink",
      "Aqua",
      "Brown",
    ]),
  },
  {
    slug: "cable_jacket_rating",
    name: "Cable Jacket Rating",
    options: fromLabels([
      "CMP (Plenum)",
      "CMR (Riser)",
      "CM (General)",
      "CMX (Residential)",
      "OSP (Outdoor)",
      "LSZH (Low Smoke Zero Halogen)",
    ]),
  },
  {
    slug: "plastics_color",
    name: "Plastics Color",
    options: fromLabels([
      "White",
      "Ivory",
      "Almond",
      "Light Almond",
      "Black",
      "Gray",
      "Orange",
      "Red",
      "Blue",
      "Stainless Steel",
    ]),
  },
  {
    slug: "hardware_finish",
    name: "Hardware Finish",
    options: fromLabels([
      "Clear Anodized",
      "Dark Bronze Anodized",
      "Matte Black",
      "Satin Chrome",
      "Brushed Nickel",
      "Polished Brass",
      "Satin Nickel",
      "Stainless Steel",
    ]),
  },
  {
    slug: "power_type",
    name: "Power Type",
    options: fromPairs([
      { value: "ac", label: "A/C" },
      { value: "dc", label: "DC" },
      { value: "ac-dc", label: "AC/DC" },
    ]),
  },
  {
    slug: "voltage",
    name: "Voltage",
    options: fromLabels(["5V", "9V", "12V", "18V", "24V", "28V", "36V", "48V"]),
  },
  {
    slug: "amp_rating",
    name: "Amp Rating",
    options: fromLabels([
      "0.25A",
      "0.5A",
      "0.75A",
      "1A",
      "1.5A",
      "2A",
      "2.5A",
      "3A",
      "4A",
      "5A",
      "7.5A",
      "10A",
    ]),
  },
  {
    slug: "poe_class",
    name: "POE Class",
    options: POE_CLASS_OPTIONS,
  },
  {
    slug: "manufacturer",
    name: "Manufacturer",
    inputType: "SELECT",
    options: fromLabels([...MANUFACTURER_EXISTING, ...MANUFACTURER_APPEND]),
  },
  {
    slug: "part_number",
    name: "Part Number",
    inputType: "TEXT",
    options: [],
  },
];

/** Hard-delete these attribute slugs (and dependents) on sync. */
export const ATTRIBUTE_SLUGS_TO_DELETE = ["vendor"] as const;

/** Soft-deactivate (isActive=false); keep history. */
export const ATTRIBUTE_SLUGS_TO_DEACTIVATE = ["color"] as const;

/** Old slug → new slug (rename in place before upsert by new slug). */
export const ATTRIBUTE_SLUG_RENAMES: Record<string, string> = {
  length_feet: "patch_cable_length",
};
