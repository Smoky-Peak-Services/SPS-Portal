import { z } from "zod";

export const createTicketSchema = z.object({
  divisionId: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  customerId: z.string().optional().or(z.literal("")),
  propertyId: z.string().optional().or(z.literal("")),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  source: z
    .enum(["STAFF", "CUSTOMER", "WEBSITE", "PHONE", "SYSTEM"])
    .default("STAFF"),
  scheduledFor: z.string().optional().or(z.literal("")),
  assignedToId: z.string().optional().or(z.literal("")),
  jobId: z.string().optional().or(z.literal("")),
});

export const updateTicketStatusSchema = z.object({
  ticketId: z.string().min(1),
  status: z.enum([
    "UNASSIGNED",
    "ASSIGNED",
    "EN_ROUTE",
    "ONSITE",
    "COMPLETED",
    "CANCELLED",
    "ON_HOLD",
  ]),
  note: z.string().max(1000).optional(),
});

export const assignTicketSchema = z.object({
  ticketId: z.string().min(1),
  userId: z.string().min(1),
  scheduledFor: z.string().optional().or(z.literal("")),
});
