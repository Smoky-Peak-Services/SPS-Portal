import { z } from "zod";

export const createCustomerSchema = z.object({
  displayName: z.string().min(1).max(200),
  type: z.enum(["RESIDENTIAL", "COMMERCIAL", "STR"]),
  divisionId: z.string().min(1),
  generalEmail: z.string().email().optional().or(z.literal("")),
  mainPhone: z.string().max(40).optional(),
  hqLine1: z.string().max(200).optional(),
  hqCity: z.string().max(100).optional(),
  hqRegion: z.string().max(40).optional(),
  hqPostal: z.string().max(20).optional(),
  notes: z.string().max(2000).optional(),
});

export const createLocationSchema = z.object({
  customerId: z.string().min(1),
  siteName: z.string().max(200).optional(),
  line1: z.string().min(1).max(200),
  line2: z.string().max(200).optional(),
  city: z.string().min(1).max(100),
  region: z.string().min(1).max(40),
  postalCode: z.string().min(1).max(20),
  classification: z.enum(["RESIDENTIAL", "COMMERCIAL"]).default("RESIDENTIAL"),
  notes: z.string().max(2000).optional(),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type CreateLocationInput = z.infer<typeof createLocationSchema>;
