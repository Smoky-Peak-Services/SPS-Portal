import { z } from "zod";

export const createJobSchema = z.object({
  divisionId: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  customerId: z.string().optional().or(z.literal("")),
  propertyId: z.string().optional().or(z.literal("")),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  billingBasis: z
    .enum(["TIME_AND_MATERIALS", "NOT_TO_EXCEED", "QUOTE"])
    .default("TIME_AND_MATERIALS"),
  scheduledFor: z.string().optional().or(z.literal("")),
  assignedToId: z.string().optional().or(z.literal("")),
});

export const updateJobStatusSchema = z.object({
  jobId: z.string().min(1),
  status: z.enum([
    "NEW",
    "SCHEDULED",
    "IN_PROGRESS",
    "COMPLETED",
    "CANCELLED",
    "ON_HOLD",
  ]),
  note: z.string().max(1000).optional(),
});

export const assignJobSchema = z.object({
  jobId: z.string().min(1),
  userId: z.string().min(1),
  scheduledFor: z.string().optional().or(z.literal("")),
});

export type CreateJobInput = z.infer<typeof createJobSchema>;
