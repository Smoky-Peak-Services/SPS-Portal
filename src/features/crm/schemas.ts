import { z } from "zod";
import { isUsRegionCode } from "./us-regions";

export const customerTypeEnum = z.enum(["RESIDENTIAL", "COMMERCIAL", "STR"]);
export const contactRoleTagEnum = z.enum([
  "CLIENT",
  "PROPERTY_MANAGER",
  "ESTIMATOR",
  "TENANT",
]);
export const billingProfileTypeEnum = z.enum(["INDIVIDUAL", "ENTITY"]);
export const serviceLocationClassificationEnum = z.enum([
  "RESIDENTIAL",
  "COMMERCIAL",
]);
export const serviceLineEnum = z.enum([
  "INTEGRATED_SYSTEMS",
  "CABIN_SERVICES",
]);
export const taxExemptEntityTypeEnum = z.enum([
  "GOVERNMENT",
  "CHURCH",
  "SCHOOL",
  "OTHER",
]);
export const smaStatusEnum = z.enum([
  "ACTIVE_PAYG",
  "ACTIVE_TERM",
  "INACTIVE",
]);

/** Null-tolerant optional string (disabled FormData fields submit as null). */
const optStr = z.preprocess(
  (v) => (v == null ? "" : String(v)),
  z.string().max(2000),
);

const optStrShort = z.preprocess(
  (v) => (v == null ? "" : String(v)),
  z.string().max(200),
);

const optStrCity = z.preprocess(
  (v) => (v == null ? "" : String(v)),
  z.string().max(100),
);

const optStrPostal = z.preprocess(
  (v) => (v == null ? "" : String(v)),
  z.string().max(20),
);

const optCoord = z
  .union([z.coerce.number(), z.literal("")])
  .optional()
  .transform((v) =>
    v === "" ? null : v === undefined ? undefined : Number(v),
  );

const optRegion = z.preprocess((v) => {
  const s = (v == null ? "" : String(v)).trim().toUpperCase();
  return s;
}, z.string().refine((s) => s === "" || isUsRegionCode(s), {
  message: "Invalid state",
}));

const requiredRegion = z.preprocess((v) => {
  const s = (v == null ? "" : String(v)).trim().toUpperCase();
  return s;
}, z.string().refine((s) => isUsRegionCode(s), { message: "State is required" }));

const optCountry = z.preprocess((v) => {
  const s = (v == null ? "US" : String(v)).trim().toUpperCase();
  if (s === "USA" || s === "UNITED STATES") return "US";
  return s || "US";
}, z.string().max(2));

const hqAddressFields = {
  hqLine1: optStrShort,
  hqLine2: optStrShort,
  hqCity: optStrCity,
  hqRegion: optRegion,
  hqPostal: optStrPostal,
  hqLat: optCoord,
  hqLng: optCoord,
};

export const createCustomerSchema = z.object({
  type: customerTypeEnum,
  displayName: z.string().min(1, "Name is required").max(200),
  divisionId: z.string().min(1, "Division is required"),
  mainPhone: optStrShort,
  generalEmail: z.string().email().optional().or(z.literal("")),
  website: optStrShort,
  summary: optStr,
  source: optStrShort,
  notes: optStr,
  ...hqAddressFields,
  contactFirstName: optStrShort,
  contactLastName: optStrShort,
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactPhone: optStrShort,
  contactRoleTag: contactRoleTagEnum.optional(),
});
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

export const updateCustomerSchema = z.object({
  id: z.string().min(1),
  type: customerTypeEnum.optional(),
  displayName: z.string().min(1).max(200).optional(),
  divisionId: z.string().min(1).optional(),
  generalEmail: optStrShort,
  mainPhone: optStrShort,
  website: optStrShort,
  source: optStrShort,
  notes: optStr,
  summary: optStr,
  ...hqAddressFields,
  /** Copy HQ address (+ primary contact) onto BillingProfile when true. */
  useAsBillingAddress: z.coerce.boolean().optional(),
  /** Create a ServiceLocation from HQ when true (skip if address already exists). */
  createServiceLocationFromRoot: z.coerce.boolean().optional(),
});

export const updateBillingProfileSchema = z.object({
  rootOrgId: z.string().min(1),
  profileType: billingProfileTypeEnum,
  billingName: optStrShort,
  billingEmail: z.string().email().optional().or(z.literal("")),
  billingPhone: optStrShort,
  billingLine1: optStrShort,
  billingLine2: optStrShort,
  billingCity: optStrCity,
  billingRegion: optRegion,
  billingPostal: optStrPostal,
  billingLat: optCoord,
  billingLng: optCoord,
  pointOfContactId: optStrShort,
  taxExemptionNumber: optStrShort,
  taxExemptEntityType: taxExemptEntityTypeEnum.optional().nullable(),
  taxExemptCertOnFile: z.coerce.boolean().optional(),
  smaStatus: smaStatusEnum.optional().nullable(),
});

export const createContactSchema = z.object({
  customerId: z.string().min(1),
  firstName: z.string().min(1).max(100),
  lastName: optStrShort,
  directEmail: z.string().email().optional().or(z.literal("")),
  directPhone: optStrShort,
  roleTag: contactRoleTagEnum.optional(),
  isPrimary: z.coerce.boolean().optional(),
  isBilling: z.coerce.boolean().optional(),
});

export const updateContactSchema = z.object({
  id: z.string().min(1),
  firstName: z.string().min(1).max(100).optional(),
  lastName: optStrShort,
  directEmail: z.string().email().optional().or(z.literal("")),
  directPhone: optStrShort,
  roleTag: contactRoleTagEnum.optional().nullable(),
  isPrimary: z.coerce.boolean().optional(),
  isBilling: z.coerce.boolean().optional(),
});

export const deleteContactSchema = z.object({
  id: z.string().min(1),
});

export const createServiceLocationSchema = z.object({
  customerId: z.string().min(1),
  siteName: optStrShort,
  classification: serviceLocationClassificationEnum,
  serviceLines: z.array(serviceLineEnum).min(1),
  line1: z.preprocess(
    (v) => (v == null ? "" : String(v)),
    z.string().min(1).max(200),
  ),
  line2: optStrShort,
  city: z.preprocess(
    (v) => (v == null ? "" : String(v)),
    z.string().min(1).max(100),
  ),
  region: requiredRegion,
  postalCode: z.preprocess(
    (v) => (v == null ? "" : String(v)),
    z.string().min(1).max(20),
  ),
  country: optCountry.optional().default("US"),
  latitude: optCoord,
  longitude: optCoord,
  notes: optStr,
  bedrooms: z.coerce.number().int().min(0).optional().nullable(),
  bathrooms: z.coerce.number().int().min(0).optional().nullable(),
  complexitySelections: z.array(z.string()).optional(),
});

export const updateServiceLocationSchema = z.object({
  id: z.string().min(1),
  siteName: optStrShort,
  classification: serviceLocationClassificationEnum.optional(),
  serviceLines: z.array(serviceLineEnum).min(1).optional(),
  line1: z.string().min(1).max(200).optional(),
  line2: optStrShort,
  city: z.string().min(1).max(100).optional(),
  region: optRegion.optional(),
  postalCode: z.string().min(1).max(20).optional(),
  country: optCountry.optional(),
  latitude: optCoord,
  longitude: optCoord,
  notes: optStr,
  bedrooms: z.coerce.number().int().min(0).optional().nullable(),
  bathrooms: z.coerce.number().int().min(0).optional().nullable(),
  complexitySelections: z.array(z.string()).optional(),
});

export const deleteServiceLocationSchema = z.object({
  id: z.string().min(1),
});

export const archiveCustomerSchema = z.object({
  id: z.string().min(1),
});

export const createCustomerActivitySchema = z.object({
  customerId: z.string().min(1),
  body: z.string().trim().min(1).max(5000),
  serviceLocationId: optStrShort,
});

export const leadSourceEnum = z.enum([
  "WEBSITE",
  "PHONE",
  "REFERRAL",
  "WALK_IN",
  "OTHER",
]);

export const leadStatusEnum = z.enum([
  "INQUIRY",
  "SITE_VISIT",
  "ESTIMATE_SENT",
  "APPROVED",
  "WON",
  "LOST",
  "DISQUALIFIED",
]);

export const createLeadSchema = z.object({
  source: leadSourceEnum.default("PHONE"),
  divisionId: z.string().min(1, "Division is required"),
  name: z.string().min(1, "Name is required").max(200),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(40).optional().or(z.literal("")),
  company: optStrShort,
  message: z.string().max(5000).optional().or(z.literal("")),
  budget: z.string().max(60).optional().or(z.literal("")),
  timeline: z.string().max(60).optional().or(z.literal("")),
  division: optStrShort,
});
export type CreateLeadInput = z.infer<typeof createLeadSchema>;

export const updateLeadStatusSchema = z.object({
  id: z.string().min(1),
  status: leadStatusEnum,
});

export const deleteLeadSchema = z.object({
  id: z.string().min(1),
});

export const promoteLeadSchema = z.object({
  leadId: z.string().min(1),
  type: customerTypeEnum,
});

export const createLeadActivitySchema = z.object({
  leadId: z.string().min(1),
  body: z.string().trim().min(1).max(5000),
});
