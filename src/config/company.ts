/**
 * SINGLE SOURCE OF TRUTH for everything company-specific.
 * Cloning the portal = edit THIS FILE ONLY.
 */

export type Segment = "commercial" | "residential" | "str";

export type DivisionColor = "blue" | "green" | "slate";

export interface DivisionConfig {
  slug: string;
  name: string;
  /**
   * Operational scopes for this division. Each (division, segment) pair is an
   * independent dataset (materials, attributes, labor, complexity, recurring).
   * Cabin Services is a single undivided scope stored under STR.
   */
  segments: Segment[];
  color: DivisionColor;
  code: string;
}

export interface FeatureFlags {
  residential: boolean;
  bidBuilder: boolean;
  scheduling: boolean;
}

export interface CrmConfig {
  budgetRanges: string[];
  disqualifyBudgets: string[];
  timelines: string[];
  defaultLeadDivisionSlug: string;
}

export interface RetentionConfig {
  customerArchiveYears: number;
  leadArchiveYears: number;
  /** Future: purge estimate history older than this (years). */
  estimateHistoryYears: number;
  /** Future: purge service ticket history older than this (years). */
  serviceTicketHistoryYears: number;
  /** Future: purge invoice history older than this (years). */
  invoiceHistoryYears: number;
}

export interface Company {
  name: string;
  shortName: string;
  domain: string;
  website: string;
  timezone: string;
  accountDomain: string;
  rootAdminEmail: string;
  brand: {
    logo: string;
    logoDark: string;
    mark: string;
    primary: string;
    accent: string;
  };
  email: { fromName: string; fromAddress: string; support: string };
  contact: { email: string; phone: string };
  office: {
    line1: string;
    line2: string;
    city: string;
    region: string;
    postal: string;
  };
  divisions: DivisionConfig[];
  features: FeatureFlags;
  crm: CrmConfig;
  retention: RetentionConfig;
}

export const company: Company = {
  name: "Smoky Peak Services",
  shortName: "Smoky Peak",
  domain: "portal.smokypeak.tech",
  website: "smokypeak.tech",
  timezone: "America/New_York",
  accountDomain: "smokypeak.tech",
  rootAdminEmail: "ryan.k@smokypeak.tech",
  brand: {
    logo: "/brand/logo-dark.png",
    logoDark: "/brand/logo-dark.png",
    mark: "/brand/mark.png",
    primary: "#0D9488",
    accent: "#2DD4BF",
  },
  email: {
    fromName: "Smoky Peak",
    fromAddress: "ops@smokypeak.tech",
    support: "support@smokypeak.tech",
  },
  contact: {
    email: "connect@smokypeak.tech",
    phone: "(865) 420-7737",
  },
  office: {
    line1: "101 East Tennessee Ave",
    line2: "1st FL",
    city: "Oak Ridge",
    region: "TN",
    postal: "37830",
  },
  divisions: [
    {
      slug: "integrated-systems",
      name: "Integrated Systems",
      segments: ["commercial", "residential"],
      color: "blue",
      code: "IS",
    },
    {
      slug: "cabin-services",
      name: "Cabin Services",
      segments: ["str"],
      color: "green",
      code: "CS",
    },
  ],
  features: {
    residential: true,
    bidBuilder: false,
    scheduling: true,
  },
  crm: {
    budgetRanges: [
      "Under $1k",
      "$1k-$3k",
      "$3k-$7k",
      "$7k-$15k",
      "$15k+",
      "Not sure",
    ],
    disqualifyBudgets: ["Under $1k"],
    timelines: ["ASAP", "2-4 weeks", "1-3 months", "Just exploring"],
    defaultLeadDivisionSlug: "integrated-systems",
  },
  retention: {
    customerArchiveYears: 5,
    leadArchiveYears: 3,
    estimateHistoryYears: 5,
    serviceTicketHistoryYears: 5,
    invoiceHistoryYears: 5,
  },
};

export type FeatureFlag = keyof FeatureFlags;

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return company.features[flag] === true;
}

export function getDivision(slug: string): DivisionConfig | undefined {
  return company.divisions.find((d) => d.slug === slug);
}

/** Slugs of operational divisions (catalog/pricing). Legal entity is not a division. */
export function operationalDivisionSlugs(): readonly string[] {
  return company.divisions.map((d) => d.slug);
}

export function isOperationalDivisionSlug(slug: string): boolean {
  return company.divisions.some((d) => d.slug === slug);
}

export function divisionName(slug: string): string {
  return getDivision(slug)?.name ?? slug;
}

export function divisionCode(slug: string): string {
  return getDivision(slug)?.code ?? "XX";
}

export interface DivisionTheme {
  dot: string;
  border: string;
  text: string;
  badge: string;
}

const DIVISION_THEMES: Record<DivisionColor, DivisionTheme> = {
  blue: {
    dot: "bg-sky-400",
    border: "border-l-sky-400",
    text: "text-sky-300",
    badge: "border-sky-500/30 bg-sky-500/15 text-sky-300",
  },
  green: {
    dot: "bg-emerald-400",
    border: "border-l-emerald-400",
    text: "text-emerald-300",
    badge: "border-emerald-500/30 bg-emerald-500/15 text-emerald-300",
  },
  slate: {
    dot: "bg-slate-400",
    border: "border-l-slate-400",
    text: "text-slate-300",
    badge: "border-slate-500/30 bg-slate-500/15 text-slate-300",
  },
};

export function divisionColor(slug: string): DivisionColor {
  return getDivision(slug)?.color ?? "slate";
}

export function divisionTheme(slug: string): DivisionTheme {
  return DIVISION_THEMES[divisionColor(slug)];
}
