/**
 * Canonical Cabin Services plan rates (prompt 14 /
 * cabin-services-master-rate-sheet.xlsx: Maintenance, Inspection, and
 * Full-Service plan tabs; 5 standard tiers + 1 custom-quote row each, 18 total).
 *
 * Rates are monthly base package rates per plan; complexity multipliers with
 * appliedTo BASE_PACKAGE_RATE adjust them via calculateAdjustedPackageRate.
 * Custom-quote rows carry no rate ("Quoted" on the sheet).
 *
 * Sheet quirks kept: SKU "FSP-2BE-2BS-STD" is verbatim from the workbook
 * ("2BS" not "2BA"); "CIP-3BE-3BA-STd" was normalized to uppercase only.
 */
import type { ServicePlanType } from "@prisma/client";

export type ServicePlanSeed = {
  planType: ServicePlanType;
  sku: string;
  description: string;
  bedrooms: number | null;
  maxBathrooms: number | null;
  rate: number | null;
  isCustomQuote: boolean;
  sortOrder: number;
};

export const CABIN_SERVICE_PLANS: ServicePlanSeed[] = [
  // Maintenance Plan Rates
  {
    planType: "MAINTENANCE",
    sku: "MP-1BE-1BA-STD",
    description: "Standard Studio or 1 Bedroom",
    bedrooms: 1,
    maxBathrooms: 1,
    rate: 125,
    isCustomQuote: false,
    sortOrder: 0,
  },
  {
    planType: "MAINTENANCE",
    sku: "MP-2BE-2BA-STD",
    description: "Standard 2 Bedroom",
    bedrooms: 2,
    maxBathrooms: 2,
    rate: 150,
    isCustomQuote: false,
    sortOrder: 1,
  },
  {
    planType: "MAINTENANCE",
    sku: "MP-3BE-3BA-STD",
    description: "Standard 3 Bedroom",
    bedrooms: 3,
    maxBathrooms: 3,
    rate: 175,
    isCustomQuote: false,
    sortOrder: 2,
  },
  {
    planType: "MAINTENANCE",
    sku: "MP-4BE-4BA-STD",
    description: "Standard 4 Bedroom",
    bedrooms: 4,
    maxBathrooms: 4,
    rate: 210,
    isCustomQuote: false,
    sortOrder: 3,
  },
  {
    planType: "MAINTENANCE",
    sku: "MP-5BE-5BA-STD",
    description: "Standard 5 Bedroom",
    bedrooms: 5,
    maxBathrooms: 5,
    rate: 250,
    isCustomQuote: false,
    sortOrder: 4,
  },
  {
    planType: "MAINTENANCE",
    sku: "MP-CUS-QUO-SPL",
    description: "Custom Quote Special Property",
    bedrooms: null,
    maxBathrooms: null,
    rate: null,
    isCustomQuote: true,
    sortOrder: 5,
  },
  // Inspection Plan Rates
  {
    planType: "INSPECTION",
    sku: "CIP-1BE-1BA-STD",
    description: "Standard Studio or 1 Bedroom",
    bedrooms: 1,
    maxBathrooms: 1,
    rate: 95,
    isCustomQuote: false,
    sortOrder: 0,
  },
  {
    planType: "INSPECTION",
    sku: "CIP-2BE-2BA-STD",
    description: "Standard 2 Bedroom",
    bedrooms: 2,
    maxBathrooms: 2,
    rate: 110,
    isCustomQuote: false,
    sortOrder: 1,
  },
  {
    planType: "INSPECTION",
    sku: "CIP-3BE-3BA-STD",
    description: "Standard 3 Bedroom",
    bedrooms: 3,
    maxBathrooms: 3,
    rate: 125,
    isCustomQuote: false,
    sortOrder: 2,
  },
  {
    planType: "INSPECTION",
    sku: "CIP-4BE-4BA-STD",
    description: "Standard 4 Bedroom",
    bedrooms: 4,
    maxBathrooms: 4,
    rate: 150,
    isCustomQuote: false,
    sortOrder: 3,
  },
  {
    planType: "INSPECTION",
    sku: "CIP-5BE-5BA-STD",
    description: "Standard 5 Bedroom",
    bedrooms: 5,
    maxBathrooms: 5,
    rate: 175,
    isCustomQuote: false,
    sortOrder: 4,
  },
  {
    planType: "INSPECTION",
    sku: "CIP-CUS-QUO-SPL",
    description: "Custom Quote Special Property",
    bedrooms: null,
    maxBathrooms: null,
    rate: null,
    isCustomQuote: true,
    sortOrder: 5,
  },
  // Full-Service Plan Rates (Maintenance & Inspection)
  {
    planType: "FULL_SERVICE",
    sku: "FSP-1BE-1BA-STD",
    description: "Standard Studio or 1 Bedroom",
    bedrooms: 1,
    maxBathrooms: 1,
    rate: 185,
    isCustomQuote: false,
    sortOrder: 0,
  },
  {
    planType: "FULL_SERVICE",
    sku: "FSP-2BE-2BS-STD",
    description: "Standard 2 Bedroom",
    bedrooms: 2,
    maxBathrooms: 2,
    rate: 215,
    isCustomQuote: false,
    sortOrder: 1,
  },
  {
    planType: "FULL_SERVICE",
    sku: "FSP-3BE-3BA-STD",
    description: "Standard 3 Bedroom",
    bedrooms: 3,
    maxBathrooms: 3,
    rate: 250,
    isCustomQuote: false,
    sortOrder: 2,
  },
  {
    planType: "FULL_SERVICE",
    sku: "FSP-4BE-4BA-STD",
    description: "Standard 4 Bedroom",
    bedrooms: 4,
    maxBathrooms: 4,
    rate: 295,
    isCustomQuote: false,
    sortOrder: 3,
  },
  {
    planType: "FULL_SERVICE",
    sku: "FSP-5BE-5BA-STD",
    description: "Standard 5 Bedroom",
    bedrooms: 5,
    maxBathrooms: 5,
    rate: 345,
    isCustomQuote: false,
    sortOrder: 4,
  },
  {
    planType: "FULL_SERVICE",
    sku: "FSP-CUS-QUO-SPL",
    description: "Custom Quote Special Property",
    bedrooms: null,
    maxBathrooms: null,
    rate: null,
    isCustomQuote: true,
    sortOrder: 5,
  },
];
