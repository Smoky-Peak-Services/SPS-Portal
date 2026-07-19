"use server";

import { revalidatePath } from "next/cache";
import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { attachCustomers, attachLocations } from "@/lib/pii-join";
import { requireArea } from "@/lib/session";
import { company, divisionCode } from "@/config/company";
import {
  assignTicketSchema,
  createTicketSchema,
  updateTicketStatusSchema,
} from "./schemas";
import type { TicketStatus } from "@prisma/client";

async function nextTicketNumber(divisionSlug: string) {
  const code = divisionCode(divisionSlug);
  const year = DateTime.now().setZone(company.timezone).toFormat("yy");
  const prefix = `TKT-${code}-${year}-`;
  const last = await prisma.ticket.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  const seq = last?.number ? Number(last.number.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

export async function listTickets() {
  const user = await requireArea("tickets");
  const where =
    user.role === "field"
      ? {
          OR: [
            { assignedToId: user.id },
            { assignments: { some: { userId: user.id } } },
          ],
        }
      : {};

  const tickets = await prisma.ticket.findMany({
    where,
    orderBy: [{ scheduledFor: "asc" }, { createdAt: "desc" }],
    take: 100,
    include: {
      division: { select: { slug: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
      job: { select: { id: true, number: true, title: true } },
    },
  });

  const withCustomers = await attachCustomers(tickets);
  return attachLocations(withCustomers);
}

export async function getTicket(id: string) {
  await requireArea("tickets");
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      division: true,
      assignedTo: { select: { id: true, name: true, email: true } },
      assignments: { include: { user: { select: { id: true, name: true } } } },
      statusEvents: { orderBy: { createdAt: "desc" }, take: 20 },
      job: { select: { id: true, number: true, title: true } },
    },
  });
  if (!ticket) return null;
  const [withCustomer] = await attachCustomers([ticket]);
  const [withLocation] = await attachLocations([withCustomer]);
  return withLocation;
}

export async function createTicket(raw: unknown) {
  const user = await requireArea("tickets");
  const data = createTicketSchema.parse(raw);
  const division = await prisma.division.findUniqueOrThrow({
    where: { id: data.divisionId },
  });
  const number = await nextTicketNumber(division.slug);

  const scheduledFor = data.scheduledFor
    ? DateTime.fromISO(data.scheduledFor, { zone: company.timezone }).toJSDate()
    : null;

  let status: TicketStatus = "UNASSIGNED";
  if (data.assignedToId) status = "ASSIGNED";

  const ticket = await prisma.ticket.create({
    data: {
      number,
      divisionId: data.divisionId,
      title: data.title,
      description: data.description || null,
      customerId: data.customerId || null,
      propertyId: data.propertyId || null,
      priority: data.priority,
      source: data.source,
      scheduledFor,
      assignedToId: data.assignedToId || null,
      jobId: data.jobId || null,
      createdById: user.id,
      status,
      statusEvents: {
        create: { toStatus: status, byId: user.id, note: "Created" },
      },
      ...(data.assignedToId
        ? {
            assignments: {
              create: { userId: data.assignedToId, isPrimary: true },
            },
          }
        : {}),
    },
  });

  revalidatePath("/tickets");
  revalidatePath("/schedule");
  revalidatePath("/field/today");
  return ticket;
}

export async function updateTicketStatus(raw: unknown) {
  const user = await requireArea("tickets");
  const data = updateTicketStatusSchema.parse(raw);
  const existing = await prisma.ticket.findUniqueOrThrow({
    where: { id: data.ticketId },
  });

  const ticket = await prisma.ticket.update({
    where: { id: data.ticketId },
    data: {
      status: data.status,
      completedAt:
        data.status === "COMPLETED" ? new Date() : existing.completedAt,
      statusEvents: {
        create: {
          fromStatus: existing.status,
          toStatus: data.status,
          note: data.note,
          byId: user.id,
        },
      },
    },
  });

  revalidatePath("/tickets");
  revalidatePath(`/tickets/${data.ticketId}`);
  revalidatePath("/field/today");
  return ticket;
}

export async function assignTicket(raw: unknown) {
  await requireArea("schedule");
  const data = assignTicketSchema.parse(raw);
  const scheduledFor = data.scheduledFor
    ? DateTime.fromISO(data.scheduledFor, { zone: company.timezone }).toJSDate()
    : undefined;

  await prisma.ticketAssignment.upsert({
    where: {
      ticketId_userId: { ticketId: data.ticketId, userId: data.userId },
    },
    create: { ticketId: data.ticketId, userId: data.userId, isPrimary: true },
    update: { isPrimary: true },
  });

  const ticket = await prisma.ticket.update({
    where: { id: data.ticketId },
    data: {
      assignedToId: data.userId,
      status: "ASSIGNED",
      ...(scheduledFor ? { scheduledFor } : {}),
    },
  });

  revalidatePath("/schedule");
  revalidatePath("/tickets");
  revalidatePath("/field/today");
  return ticket;
}
