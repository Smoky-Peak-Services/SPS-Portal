/**
 * Canonical IS-Commercial complexity multipliers (prompt 10, reshaped in 14).
 * All rows are PERCENT applied to TOTAL_LABOR; values are decimals (0.08 = 8%).
 * Descriptions are the CSV "Notes and Rules" text verbatim.
 */
import type { ComplexitySeed } from "./complexity-seed-types";

export const IS_COM_COMPLEXITY_MULTIPLIERS: ComplexitySeed[] = [
  {
    name: "Existing Conduit Reuse",
    slug: "existing-conduit-reuse",
    category: "Structural",
    multiplierType: "PERCENT",
    appliedTo: "TOTAL_LABOR",
    value: 0.08,
    description:
      "Applied when existing conduit must be used for new cable runs requiring pull string retrieval, conduit inspection, and potential reaming or cleaning prior to installation. Reflects increased labor time associated with working within existing pathway infrastructure.",
    sortOrder: 0,
  },
  {
    name: "High Ceiling or Elevated Work Areas",
    slug: "high-ceiling-or-elevated-work-areas",
    category: "Structural",
    multiplierType: "PERCENT",
    appliedTo: "TOTAL_LABOR",
    value: 0.1,
    description:
      "Applied when installation requires work at heights exceeding standard ladder reach including but not limited to scissor lift, boom lift, or scaffolding required installations. Reflects increased setup time, equipment requirements, and safety compliance demands on elevated work.",
    sortOrder: 1,
  },
  {
    name: "Confined Space Access",
    slug: "confined-space-access",
    category: "Structural",
    multiplierType: "PERCENT",
    appliedTo: "TOTAL_LABOR",
    value: 0.12,
    description:
      "Applied when installation requires access to confined spaces including crawl spaces, ceiling plenums with restricted clearance, mechanical rooms with limited entry, or below grade spaces requiring special access procedures. Reflects increased physical demands and time associated with confined space work.",
    sortOrder: 2,
  },
  {
    name: "After Hours Required Installation",
    slug: "after-hours-required-installation",
    category: "Access",
    multiplierType: "PERCENT",
    appliedTo: "TOTAL_LABOR",
    value: 0.2,
    description:
      "Applied when the client requires installation to occur outside of standard business hours due to operational requirements. Reflects premium labor cost associated with after hours scheduling and technician availability. Applied to total labor cost in addition to standard after hours labor rates.",
    sortOrder: 3,
  },
  {
    name: "Occupied Building Restrictions",
    slug: "occupied-building-restrictions",
    category: "Access",
    multiplierType: "PERCENT",
    appliedTo: "TOTAL_LABOR",
    value: 0.08,
    description:
      "Applied when installation must be performed within an occupied and actively operating building requiring noise restrictions, phased access, coordinated scheduling around tenant operations, or additional protection of existing finishes and furnishings.",
    sortOrder: 4,
  },
  {
    name: "Multi-Floor or Multi-Building Campus",
    slug: "multi-floor-or-multi-building-campus",
    category: "Structural",
    multiplierType: "PERCENT",
    appliedTo: "TOTAL_LABOR",
    value: 0.12,
    description:
      "Applied when the project scope spans multiple floors within a single building or multiple buildings within a campus environment. Reflects increased mobilization time, material staging complexity, and coordination demands across distributed work areas.",
    sortOrder: 5,
  },
  {
    name: "Prevailing Wage Requirements",
    slug: "prevailing-wage-requirements",
    category: "Compliance",
    multiplierType: "PERCENT",
    appliedTo: "TOTAL_LABOR",
    value: 0.18,
    description:
      "Applied when the project is subject to prevailing wage requirements under federal or state contract regulations. Reflects the increased labor cost associated with prevailing wage rates above standard market billing rates for East Tennessee.",
    sortOrder: 6,
  },
  {
    name: "Data Center or Cleanroom Environment",
    slug: "data-center-or-cleanroom-environment",
    category: "Compliance",
    multiplierType: "PERCENT",
    appliedTo: "TOTAL_LABOR",
    value: 0.15,
    description:
      "Applied when installation occurs within a data center, server room, or cleanroom environment requiring strict protocols for dust control, electrostatic discharge prevention, equipment protection, and access credentialing. Reflects the increased complexity, preparation time, and compliance requirements of working in sensitive environments.",
    sortOrder: 7,
  },
  {
    name: "Historical or Protected Building Restrictions",
    slug: "historical-or-protected-building-restrictions",
    category: "Compliance",
    multiplierType: "PERCENT",
    appliedTo: "TOTAL_LABOR",
    value: 0.15,
    description:
      "Applied when installation occurs within a historically designated or architecturally protected building requiring non-destructive installation methods, special fastening systems, preservation of existing finishes, and potential coordination with preservation authorities. Reflects the significantly increased labor time and material cost associated with compliant installation in protected structures.",
    sortOrder: 8,
  },
  {
    name: "Escort or Access Limitations",
    slug: "escort-or-access-limitations",
    category: "Compliance",
    multiplierType: "PERCENT",
    appliedTo: "TOTAL_LABOR",
    value: 0.12,
    description:
      "Applied when site access requires credentialed escort personnel, security clearance verification, badging procedures, or scheduled access windows that limit technician movement throughout the facility. Includes government buildings, correctional facilities, and healthcare facilities with secure wing requirements. Reflects the increased labor time associated with access delays, mandatory escort wait times, and restricted scheduling throughout the visit.",
    sortOrder: 9,
  },
];

/** Slug used for After Hours Required Installation — may stack with LaborRateType.AFTER_HOURS. */
export const AFTER_HOURS_COMPLEXITY_SLUG = "after-hours-required-installation";
