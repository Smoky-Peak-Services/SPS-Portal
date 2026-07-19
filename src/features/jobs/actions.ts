"use server";

import { revalidatePath } from "next/cache";
import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { attachCustomers, attachLocations } from "@/lib/pii-join";
import { requireArea, requireUser } from "@/lib/session";
import { company, divisionCode } from "@/config/company";
import {
  assignJobSchema,
  createJobSchema,
  updateJobStatusSchema,
} from "./schemas";
import type { JobStatus } from "@prisma/client";

async function nextJobNumber(divisionSlug: string) {
  const code = divisionCode(divisionSlug);
  const year = DateTime.now().setZone(company.timezone).toFormat("yy");
  const prefix = `JOB-${code}-${year}-`;
  const last = await prisma.job.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  const seq = last?.number ? Number(last.number.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

export async function listJobs() {
  const user = await requireArea("jobs");
  const where =
    user.role === "field"
      ? {
          OR: [
            { assignedToId: user.id },
            { assignments: { some: { userId: user.id } } },
          ],
        }
      : {};

  const jobs = await prisma.job.findMany({
    where,
    orderBy: [{ scheduledFor: "asc" }, { createdAt: "desc" }],
    take: 100,
    include: {
      division: { select: { slug: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
    },
  });

  const withCustomers = await attachCustomers(jobs);
  return attachLocations(withCustomers);
}

export async function getJob(id: string) {
  await requireArea("jobs");
  const job = await prisma.job.findUnique({
    where: { id },
    include: {
      division: true,
      assignedTo: { select: { id: true, name: true, email: true } },
      assignments: { include: { user: { select: { id: true, name: true } } } },
      statusEvents: { orderBy: { createdAt: "desc" }, take: 20 },
      tickets: {
        select: { id: true, number: true, title: true, status: true },
      },
    },
  });
  if (!job) return null;
  const [withCustomer] = await attachCustomers([job]);
  const [withLocation] = await attachLocations([withCustomer]);
  return withLocation;
}

export async function createJob(raw: unknown) {
  const user = await requireArea("jobs");
  const data = createJobSchema.parse(raw);
  const division = await prisma.division.findUniqueOrThrow({
    where: { id: data.divisionId },
  });
  const number = await nextJobNumber(division.slug);

  const scheduledFor = data.scheduledFor
    ? DateTime.fromISO(data.scheduledFor, { zone: company.timezone }).toJSDate()
    : null;

  const status: JobStatus = scheduledFor ? "SCHEDULED" : "NEW";

  const job = await prisma.job.create({
    data: {
      number,
      divisionId: data.divisionId,
      title: data.title,
      description: data.description || null,
      customerId: data.customerId || null,
      propertyId: data.propertyId || null,
      priority: data.priority,
      billingBasis: data.billingBasis,
      scheduledFor,
      assignedToId: data.assignedToId || null,
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

  revalidatePath("/jobs");
  revalidatePath("/schedule");
  revalidatePath("/field/today");
  return job;
}

export async function updateJobStatus(raw: unknown) {
  const user = await requireArea("jobs");
  const data = updateJobStatusSchema.parse(raw);
  const existing = await prisma.job.findUniqueOrThrow({
    where: { id: data.jobId },
  });

  const job = await prisma.job.update({
    where: { id: data.jobId },
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

  revalidatePath("/jobs");
  revalidatePath(`/jobs/${data.jobId}`);
  revalidatePath("/field/today");
  return job;
}

export async function assignJob(raw: unknown) {
  await requireArea("schedule");
  const data = assignJobSchema.parse(raw);
  const scheduledFor = data.scheduledFor
    ? DateTime.fromISO(data.scheduledFor, { zone: company.timezone }).toJSDate()
    : undefined;

  await prisma.jobAssignment.upsert({
    where: { jobId_userId: { jobId: data.jobId, userId: data.userId } },
    create: { jobId: data.jobId, userId: data.userId, isPrimary: true },
    update: { isPrimary: true },
  });

  const job = await prisma.job.update({
    where: { id: data.jobId },
    data: {
      assignedToId: data.userId,
      ...(scheduledFor ? { scheduledFor, status: "SCHEDULED" } : {}),
    },
  });

  revalidatePath("/schedule");
  revalidatePath("/jobs");
  revalidatePath("/field/today");
  return job;
}

export async function listFieldUsers() {
  await requireUser();
  return prisma.user.findMany({
    where: { role: { in: ["field", "staff", "admin"] } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, role: true },
  });
}
