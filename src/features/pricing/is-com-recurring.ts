/**
 * Canonical IS-Commercial recurring fee literals (prompt 11 /
 * is-com-recurring-fee-structure.csv), with Ryan's two CSV corrections:
 * 1. Drop duplicate Monthly Monitoring $18.99 — only $39.99 / $51.99 / $46.79.
 * 2. Bank of Hours CSV dollars are placeholders — sell rate is live
 *    Tech1&2.standardBillingRate × 0.90 (prompt 09 LAB-COM-T12-SIS).
 */
import type {
  BillingCycle,
  RateValueType,
  RecurringFeeType,
  RecurringFeeUnit,
} from "@prisma/client";

export const IS_COM_RECURRING_MARKUP = 1.3;
export const IS_COM_SMA_BUNDLE_FACTOR = 0.9;
/** Bank of Hours discount off Tech 1&2 standard billing rate. */
export const IS_COM_BOH_RATE_FACTOR = 0.9;

export type IsComRecurringFeeSeed = {
  sku: string;
  description: string;
  unit: RecurringFeeUnit;
  baseCost: number;
  directPurchaseRate: number;
  smaBundledRate: number;
  billingCycle: BillingCycle;
  feeType: RecurringFeeType;
  valueType: RateValueType;
  systemValueMin: number | null;
  systemValueMax: number | null;
  notes: string;
  sortOrder: number;
};

export const IS_COM_RECURRING_FEES: IsComRecurringFeeSeed[] = [
  {
    sku: "REC-AMA-TR1-ANN",
    description: "Annual Maintenance Agreement - System Value $500-$5,000",
    unit: "YEAR",
    baseCost: 375.0,
    directPurchaseRate: 487.5,
    smaBundledRate: 438.75,
    billingCycle: "ANNUAL",
    feeType: "SMA_BASE_TIER",
    valueType: "CURRENCY",
    systemValueMin: 500,
    systemValueMax: 5000,
    notes:
      "Base Rate for annual maintenance agreements. Covers only standard maintence and updates. Bank of hours, and System cost percentages stack on top of the base rate. Tier 1 System Value not to Exceed $5,000",
    sortOrder: 0,
  },
  {
    sku: "REC-AMA-TR2-ANN",
    description: "Annual Maintenance Agreement - System Value $5,000-$10,000",
    unit: "YEAR",
    baseCost: 750.0,
    directPurchaseRate: 975.0,
    smaBundledRate: 877.5,
    billingCycle: "ANNUAL",
    feeType: "SMA_BASE_TIER",
    valueType: "CURRENCY",
    systemValueMin: 5000,
    systemValueMax: 10000,
    notes:
      "Base Rate for annual maintenance agreements. Covers only standard maintence and updates. Bank of hours, and System cost percentages stack on top of the base rate. Tier 2 System Value not to Exceed $10,000",
    sortOrder: 1,
  },
  {
    sku: "REC-AMA-TR3-ANN",
    description: "Annual Maintenance Agreement - System Value $10,000-$18,000",
    unit: "YEAR",
    baseCost: 1000.0,
    directPurchaseRate: 1300.0,
    smaBundledRate: 1170.0,
    billingCycle: "ANNUAL",
    feeType: "SMA_BASE_TIER",
    valueType: "CURRENCY",
    systemValueMin: 10000,
    systemValueMax: 18000,
    notes:
      "Base Rate for annual maintenance agreements. Covers only standard maintence and updates. Bank of hours, and System cost percentages stack on top of the base rate. Tier 3 System Value not to Exceed $18,000",
    sortOrder: 2,
  },
  {
    sku: "REC-AMA-TR4-ANN",
    description: "Annual Maintenance Agreement - System Value $18,000-$30,000",
    unit: "YEAR",
    baseCost: 1850.0,
    directPurchaseRate: 2405.0,
    smaBundledRate: 2164.5,
    billingCycle: "ANNUAL",
    feeType: "SMA_BASE_TIER",
    valueType: "CURRENCY",
    systemValueMin: 18000,
    systemValueMax: 30000,
    notes:
      "Base Rate for annual maintenance agreements. Covers only standard maintence and updates. Bank of hours, and System cost percentages stack on top of the base rate. Tier 4 System Value not to Exceed $30,000",
    sortOrder: 3,
  },
  {
    sku: "REC-AMA-TR5-ANN",
    description: "Annual Maintenance Agreement - System Value $30,000<",
    unit: "YEAR",
    baseCost: 2300.0,
    directPurchaseRate: 2990.0,
    smaBundledRate: 2691.0,
    billingCycle: "ANNUAL",
    feeType: "SMA_BASE_TIER",
    valueType: "CURRENCY",
    systemValueMin: 30000,
    systemValueMax: null,
    notes:
      "Base Rate for annual maintenance agreements. Covers only standard maintence and updates. Bank of hours, and System cost percentages stack on top of the base rate. Tier 5 System Value exceeds $30,000",
    sortOrder: 4,
  },
  {
    sku: "REC-SMA_SVM-ANN",
    description: "SMA System Value Modifier",
    unit: "YEAR",
    baseCost: 0.12,
    directPurchaseRate: 0.156,
    smaBundledRate: 0.1404,
    billingCycle: "ANNUAL",
    feeType: "SMA_SVM",
    valueType: "PERCENT",
    systemValueMin: null,
    systemValueMax: null,
    notes:
      "The System Value Modifier is a percentage applied to the total material value of the covered system and is stacked on top of the Base SMA Rate. For systems installed by Smoky Peak the material cost at time of install is used as the valuation basis. For inherited systems or systems exceeding five years of age the valuation is determined by current market direct replacement cost for all covered equipment. System valuations are reviewed and updated every five years or at contract renewal following a system revaluation. The SVM percentage varies by purchase type and is applied annually as part of the total SMA calculation.",
    sortOrder: 5,
  },
  {
    sku: "REC-LAB-BOH-ANN",
    description: "SMA Bank of Hours",
    unit: "YEAR",
    // Placeholders only — engine never reads these columns.
    baseCost: 0,
    directPurchaseRate: 0,
    smaBundledRate: 0,
    billingCycle: "ANNUAL",
    feeType: "SMA_BANK_OF_HOURS",
    valueType: "CURRENCY",
    systemValueMin: null,
    systemValueMax: null,
    notes:
      "Bank of Hours available for pre purchase to cover labor costs for covered service items in SMA Contracts. Sell rate is derived live: Tech 1&2 standardBillingRate × 0.90 (ignore CSV dollar columns). Unused hours do not roll over at renewal (informational; enforcement is contract-lifecycle work).",
    sortOrder: 6,
  },
  {
    sku: "REC-MON-MON",
    description: "Monthly Monitoring Service",
    unit: "MONTH",
    baseCost: 39.99,
    directPurchaseRate: 51.99,
    smaBundledRate: 46.79,
    billingCycle: "MONTHLY",
    feeType: "MONTHLY_SERVICE",
    valueType: "CURRENCY",
    systemValueMin: null,
    systemValueMax: null,
    notes:
      "24/7 system monitoring provided through a 3rd party monitoring company",
    sortOrder: 7,
  },
  {
    sku: "REC-CLD-STG-MON",
    description: "Cloud Storage Backup",
    unit: "MONTH",
    baseCost: 49.99,
    directPurchaseRate: 64.99,
    smaBundledRate: 58.49,
    billingCycle: "MONTHLY",
    feeType: "MONTHLY_SERVICE",
    valueType: "CURRENCY",
    systemValueMin: null,
    systemValueMax: null,
    notes:
      "1TB cloud storage backup. Use for System images, evidence locked footage, or additional recording space",
    sortOrder: 8,
  },
  {
    sku: "REC-CLD-ACP-MON",
    description: "Cloud Door Access Hosting (Per Door)",
    unit: "MONTH",
    baseCost: 20.0,
    directPurchaseRate: 26.0,
    smaBundledRate: 23.4,
    billingCycle: "MONTHLY",
    feeType: "MONTHLY_SERVICE",
    valueType: "CURRENCY",
    systemValueMin: null,
    systemValueMax: null,
    notes: "Cloud hosting for Access Control System. Per door rate",
    sortOrder: 9,
  },
  {
    sku: "REC-CLD-VMS-MON",
    description: "Cloud VMS Hosting (Per Camera)",
    unit: "MONTH",
    baseCost: 20.0,
    directPurchaseRate: 26.0,
    smaBundledRate: 23.4,
    billingCycle: "MONTHLY",
    feeType: "MONTHLY_SERVICE",
    valueType: "CURRENCY",
    systemValueMin: null,
    systemValueMax: null,
    notes:
      "Cloud hosting for Video Management System. Per camera rate. Each camera include 45 days of recording storage at 15FPS 1080P",
    sortOrder: 10,
  },
];
