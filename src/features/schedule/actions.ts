"use server";

import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { attachCustomers, attachLocations } from "@/lib/pii-join";
import { requireArea, requireUser } from "@/lib/session";
import { company } from "@/config/company";

export async function getMyDay() {
  const user = await requireArea("myDay");
  const start = DateTime.now()
    .setZone(company.timezone)
    .startOf("day")
    .toJSDate();
  const end = DateTime.now().setZone(company.timezone).endOf("day").toJSDate();

  const [dayJobs, tickets] = await Promise.all([
    prisma.job.findMany({
      where: {
        AND: [
          {
            OR: [
              { assignedToId: user.id },
              { assignments: { some: { userId: user.id } } },
            ],
          },
          { status: { notIn: ["CANCELLED", "COMPLETED"] } },
          {
            OR: [
              { scheduledFor: { gte: start, lte: end } },
              {
                AND: [
                  { scheduledFor: null },
                  {
                    status: {
                      in: ["NEW", "SCHEDULED", "IN_PROGRESS", "ON_HOLD"],
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
      orderBy: { scheduledFor: "asc" },
      include: {
        division: { select: { slug: true, name: true } },
      },
    }),
    prisma.ticket.findMany({
      where: {
        OR: [
          { assignedToId: user.id },
          { assignments: { some: { userId: user.id } } },
        ],
        status: { notIn: ["CANCELLED", "COMPLETED"] },
      },
      orderBy: { scheduledFor: "asc" },
      take: 50,
      include: {
        division: { select: { slug: true, name: true } },
      },
    }),
  ]);

  return {
    jobs: await attachLocations(await attachCustomers(dayJobs)),
    tickets: await attachLocations(await attachCustomers(tickets)),
  };
}

export async function getScheduleWeek(weekStartIso?: string) {
  await requireArea("schedule");
  const zone = company.timezone;
  const start = weekStartIso
    ? DateTime.fromISO(weekStartIso, { zone }).startOf("day")
    : DateTime.now().setZone(zone).startOf("week");
  const end = start.plus({ days: 7 });

  const [jobs, tickets, techs] = await Promise.all([
    prisma.job.findMany({
      where: {
        scheduledFor: { gte: start.toJSDate(), lt: end.toJSDate() },
        status: { not: "CANCELLED" },
      },
      orderBy: { scheduledFor: "asc" },
      include: {
        division: { select: { slug: true, name: true } },
        assignedTo: { select: { id: true, name: true } },
      },
    }),
    prisma.ticket.findMany({
      where: {
        scheduledFor: { gte: start.toJSDate(), lt: end.toJSDate() },
        status: { not: "CANCELLED" },
      },
      orderBy: { scheduledFor: "asc" },
      include: {
        division: { select: { slug: true, name: true } },
        assignedTo: { select: { id: true, name: true } },
      },
    }),
    prisma.user.findMany({
      where: { role: { in: ["field", "staff", "admin"] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, role: true },
    }),
  ]);

  return {
    weekStart: start.toISODate()!,
    weekEnd: end.toISODate()!,
    jobs: await attachLocations(await attachCustomers(jobs)),
    tickets: await attachLocations(await attachCustomers(tickets)),
    techs,
  };
}

export async function listDivisions() {
  await requireUser();
  return prisma.division.findMany({ orderBy: { name: "asc" } });
}
