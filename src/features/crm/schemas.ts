import { z } from "zod";

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

const optStr = z.string().optional().or(z.literal(""));

const optCoord = z
  .union([z.coerce.number(), z.literal("")])
  .optional()
  .transform((v) => (v === "" || v === undefined ? null : Number(v)));

const hqAddressFields = {
  hqLine1: optStr,
  hqLine2: optStr,
  hqCity: optStr,
  hqRegion: optStr,
  hqPostal: optStr,
  hqLat: optCoord,
  hqLng: optCoord,
};

export const createCustomerSchema = z.object({
  type: customerTypeEnum,
  displayName: z.string().min(1, "Name is required").max(200),
  divisionId: z.string().min(1, "Division is required"),
  mainPhone: optStr,
  generalEmail: z.string().email().optional().or(z.literal("")),
  website: optStr,
  summary: optStr,
  source: optStr,
  notes: optStr,
  ...hqAddressFields,
  contactFirstName: optStr,
  contactLastName: optStr,
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactPhone: optStr,
  contactRoleTag: contactRoleTagEnum.optional(),
});
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

export const updateCustomerSchema = z.object({
  id: z.string().min(1),
  type: customerTypeEnum.optional(),
  displayName: z.string().min(1).max(200).optional(),
  divisionId: z.string().min(1).optional(),
  generalEmail: optStr,
  mainPhone: optStr,
  website: optStr,
  source: optStr,
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
  billingName: optStr,
  billingEmail: z.string().email().optional().or(z.literal("")),
  billingPhone: optStr,
  billingLine1: optStr,
  billingLine2: optStr,
  billingCity: optStr,
  billingRegion: optStr,
  billingPostal: optStr,
  billingLat: optCoord,
  billingLng: optCoord,
  pointOfContactId: optStr,
  taxExemptionNumber: optStr,
  taxExemptEntityType: taxExemptEntityTypeEnum.optional().nullable(),
  taxExemptCertOnFile: z.coerce.boolean().optional(),
  smaStatus: smaStatusEnum.optional().nullable(),
});

export const createContactSchema = z.object({
  customerId: z.string().min(1),
  firstName: z.string().min(1).max(100),
  lastName: optStr,
  directEmail: z.string().email().optional().or(z.literal("")),
  directPhone: optStr,
  roleTag: contactRoleTagEnum.optional(),
  isPrimary: z.coerce.boolean().optional(),
  isBilling: z.coerce.boolean().optional(),
});

export const updateContactSchema = z.object({
  id: z.string().min(1),
  firstName: z.string().min(1).max(100).optional(),
  lastName: optStr,
  directEmail: z.string().email().optional().or(z.literal("")),
  directPhone: optStr,
  roleTag: contactRoleTagEnum.optional().nullable(),
  isPrimary: z.coerce.boolean().optional(),
  isBilling: z.coerce.boolean().optional(),
});

export const deleteContactSchema = z.object({
  id: z.string().min(1),
});

export const createServiceLocationSchema = z.object({
  customerId: z.string().min(1),
  siteName: optStr,
  classification: serviceLocationClassificationEnum,
  serviceLines: z.array(serviceLineEnum).min(1),
  line1: z.string().min(1).max(200),
  line2: optStr,
  city: z.string().min(1).max(100),
  region: z.string().min(1).max(50),
  postalCode: z.string().min(1).max(20),
  country: z.string().max(2).optional().default("US"),
  latitude: optCoord,
  longitude: optCoord,
  notes: optStr,
  bedrooms: z.coerce.number().int().min(0).optional().nullable(),
  bathrooms: z.coerce.number().int().min(0).optional().nullable(),
  complexitySelections: z.array(z.string()).optional(),
});

export const updateServiceLocationSchema = z.object({
  id: z.string().min(1),
  siteName: optStr,
  classification: serviceLocationClassificationEnum.optional(),
  serviceLines: z.array(serviceLineEnum).min(1).optional(),
  line1: z.string().min(1).max(200).optional(),
  line2: optStr,
  city: z.string().min(1).max(100).optional(),
  region: z.string().min(1).max(50).optional(),
  postalCode: z.string().min(1).max(20).optional(),
  country: z.string().max(2).optional(),
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
  body: z.string().min(1).max(5000),
  serviceLocationId: optStr,
});
