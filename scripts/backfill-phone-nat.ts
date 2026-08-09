/**
 * Backfill Contact.directPhoneNat and Lead.phoneNat from raw phone columns.
 *
 * Usage:
 *   npm run backfill:phone-nat
 *   npm run backfill:phone-nat -- --repair
 *
 * --repair re-runs upsertMatchedActivity for undismissed PhoneEvents in the
 * last 90 days (writes Activity rows). Idempotent via Activity.externalId.
 * Do not run --repair without an explicit go-ahead.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../prisma/generated/pii";
import { phoneNat10 } from "../src/lib/phone-parse";
import { upsertMatchedActivity } from "../src/features/phone/match-target";

const BATCH = 200;

function normalizeSsl(url?: string) {
  if (!url) return url;
  return url.replace(
    /sslmode=(prefer|require|verify-ca)\b/i,
    "sslmode=verify-full",
  );
}

async function main() {
  const repair = process.argv.includes("--repair");
  const url = process.env.PII_DATABASE_URL?.trim();
  if (!url) {
    console.error("PII_DATABASE_URL missing");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: normalizeSsl(url) });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    let contactScanned = 0;
    let contactSet = 0;
    let contactUnparseable = 0;
    let contactCursor: string | undefined;

    console.log("Backfilling Contact.directPhoneNat…");
    for (;;) {
      const rows = await prisma.contact.findMany({
        where: contactCursor ? { id: { gt: contactCursor } } : undefined,
        orderBy: { id: "asc" },
        take: BATCH,
        select: { id: true, directPhone: true, directPhoneNat: true },
      });
      if (rows.length === 0) break;
      contactCursor = rows[rows.length - 1]!.id;

      for (const row of rows) {
        contactScanned += 1;
        const nat = phoneNat10(row.directPhone);
        if (row.directPhone && !nat) contactUnparseable += 1;
        if (nat === row.directPhoneNat) continue;
        await prisma.contact.update({
          where: { id: row.id },
          data: { directPhoneNat: nat },
        });
        contactSet += 1;
      }
    }

    let leadScanned = 0;
    let leadSet = 0;
    let leadUnparseable = 0;
    let leadCursor: string | undefined;

    console.log("Backfilling Lead.phoneNat…");
    for (;;) {
      const rows = await prisma.lead.findMany({
        where: leadCursor ? { id: { gt: leadCursor } } : undefined,
        orderBy: { id: "asc" },
        take: BATCH,
        select: { id: true, phone: true, phoneNat: true },
      });
      if (rows.length === 0) break;
      leadCursor = rows[rows.length - 1]!.id;

      for (const row of rows) {
        leadScanned += 1;
        const nat = phoneNat10(row.phone);
        if (row.phone && !nat) leadUnparseable += 1;
        if (nat === row.phoneNat) continue;
        await prisma.lead.update({
          where: { id: row.id },
          data: { phoneNat: nat },
        });
        leadSet += 1;
      }
    }

    console.log(
      `Contacts: scanned=${contactScanned} set=${contactSet} unparseable=${contactUnparseable}`,
    );
    console.log(
      `Leads: scanned=${leadScanned} set=${leadSet} unparseable=${leadUnparseable}`,
    );

    if (!repair) {
      console.log(
        "Done (no --repair). To attach Activities for recent PhoneEvents, re-run with --repair after review.",
      );
      return;
    }

    console.log(
      "Repair: upsertMatchedActivity for undismissed PhoneEvents (last 90 days)…",
    );
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    let eventCursor: string | undefined;
    let repaired = 0;
    let skipped = 0;

    for (;;) {
      const events = await prisma.phoneEvent.findMany({
        where: {
          dismissed: false,
          occurredAt: { gte: since },
          partyNat: { not: null },
          ...(eventCursor ? { id: { gt: eventCursor } } : {}),
        },
        orderBy: { id: "asc" },
        take: BATCH,
        select: {
          id: true,
          externalId: true,
          kind: true,
          partyNat: true,
          body: true,
        },
      });
      if (events.length === 0) break;
      eventCursor = events[events.length - 1]!.id;

      for (const e of events) {
        const line = (e.body ?? "").split("\n").filter(Boolean)[0] ?? "";
        if (!line || !e.partyNat) {
          skipped += 1;
          continue;
        }
        const result = await upsertMatchedActivity({
          externalId: e.externalId,
          kind: e.kind,
          partyNat: e.partyNat,
          line,
        });
        if (result === "skipped") skipped += 1;
        else repaired += 1;
      }
    }

    console.log(`Repair: attached/merged=${repaired} skipped=${skipped}`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
