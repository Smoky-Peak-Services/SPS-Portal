import { createHash, randomBytes } from "node:crypto";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { company } from "../src/config/company";
import { prisma } from "../src/lib/prisma";
import { prismaPii } from "../src/lib/prisma-pii";
import { seedStripeTaxCodes } from "../scripts/seed-stripe-tax-codes";
import { syncAttributeLists } from "../scripts/sync-attribute-lists";
import { seedCapabilities } from "../src/config/capabilities";
import { ensureCoreAssignmentsForAllCategories } from "../src/features/materials/ensure-core-assignments";
import { deriveTaxProfileFromStripeCode } from "../src/features/materials/tax";
import { seedLaborRates } from "../scripts/seed-labor-rates";
import { seedComplexityMultipliers } from "../scripts/seed-complexity-multipliers";
import { seedRecurringFees } from "../scripts/seed-recurring-fees";
import { seedServicePlans } from "../scripts/seed-service-plans";

const seedAuth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: { enabled: true, disableSignUp: false },
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
});

function hashIngestKey(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

async function setCredentialPassword(userId: string, password: string) {
  const ctx = (await seedAuth.$context) as unknown as {
    password: { hash: (p: string) => Promise<string> };
  };
  const hash = await ctx.password.hash(password);
  const existing = await prisma.account.findFirst({
    where: { userId, providerId: "credential" },
    select: { id: true },
  });
  if (existing) {
    await prisma.account.update({
      where: { id: existing.id },
      data: { password: hash },
    });
  } else {
    await prisma.account.create({
      data: {
        accountId: userId,
        providerId: "credential",
        userId,
        password: hash,
      },
    });
  }
}

async function ensureAdminMemberships(userId: string) {
  const divisions = await prisma.division.findMany({
    where: { slug: { in: company.divisions.map((d) => d.slug) } },
  });
  for (const div of divisions) {
    await prisma.divisionMembership.upsert({
      where: { userId_divisionId: { userId, divisionId: div.id } },
      create: { userId, divisionId: div.id },
      update: {},
    });
  }
  return divisions;
}

async function main() {
  console.log("Seeding divisions…");
  for (const d of company.divisions) {
    const segments = [...d.segments];
    const div = await prisma.division.upsert({
      where: { slug: d.slug },
      create: { slug: d.slug, name: d.name, segments },
      update: { name: d.name, segments },
    });
    await prismaPii.division.upsert({
      where: { id: div.id },
      create: { id: div.id, slug: d.slug, name: d.name, segments },
      update: { slug: d.slug, name: d.name, segments },
    });
    console.log(`  ✓ ${d.slug}`);
  }

  // Legal entity was never an operational division — drop legacy catalog placeholder.
  const legacyLegal = await prisma.division.findUnique({
    where: { slug: "smoky-peak-services" },
    include: {
      _count: {
        select: {
          materialDomains: true,
          laborRateConfigs: true,
          laborPositions: true,
          complexityMultipliers: true,
          recurringFeeItems: true,
        },
      },
    },
  });
  if (legacyLegal) {
    const c = legacyLegal._count;
    const hasCatalog =
      c.materialDomains +
        c.laborRateConfigs +
        c.laborPositions +
        c.complexityMultipliers +
        c.recurringFeeItems >
      0;
    if (hasCatalog) {
      console.warn(
        "  ! smoky-peak-services still has catalog rows — not deleted",
      );
    } else {
      await prisma.divisionMembership.deleteMany({
        where: { divisionId: legacyLegal.id },
      });
      await prisma.division.delete({ where: { id: legacyLegal.id } });
      try {
        await prismaPii.ingestKey.deleteMany({
          where: { divisionId: legacyLegal.id },
        });
        await prismaPii.division.delete({ where: { id: legacyLegal.id } });
      } catch {
        // PII may be unconfigured or already cleaned
      }
      console.log("  ✓ removed legacy smoky-peak-services (legal entity)");
    }
  }

  console.log("Seeding ingest keys…");
  const divisions = await prisma.division.findMany({
    where: { slug: { in: company.divisions.map((d) => d.slug) } },
  });
  for (const div of divisions) {
    const existingKey = await prismaPii.ingestKey.findFirst({
      where: { divisionId: div.id, revokedAt: null },
    });
    if (existingKey) continue;
    const raw = `spk_${div.slug.slice(0, 3)}_${randomBytes(24).toString("hex")}`;
    await prismaPii.ingestKey.create({
      data: {
        divisionId: div.id,
        label: `${div.name} website`,
        keyHash: hashIngestKey(raw),
        keyPrefix: raw.slice(0, 12),
      },
    });
    console.log(`  [${div.slug}] ${raw}`);
  }

  const email = process.env.SEED_ADMIN_EMAIL ?? company.rootAdminEmail;
  const name = process.env.SEED_ADMIN_NAME ?? "Root Admin";
  const password = process.env.SEED_ADMIN_PASSWORD?.trim();

  if (password) {
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      await seedAuth.api.signUpEmail({ body: { email, password, name } });
      console.log(`admin created: ${email}`);
    } else {
      await setCredentialPassword(user.id, password);
      console.log(`admin credential reset: ${email}`);
    }

    user = await prisma.user.update({
      where: { email },
      data: { role: "admin", emailVerified: true },
    });
    await ensureAdminMemberships(user.id);
    await prisma.invitation.deleteMany({ where: { email } });
  } else {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { role: "admin" },
      });
      await ensureAdminMemberships(existing.id);
      console.log(
        `admin already exists — elevated: ${email} (no SEED_ADMIN_PASSWORD; password unchanged)`,
      );
    } else {
      const token = randomBytes(24).toString("hex");
      await prisma.invitation.create({
        data: {
          email,
          role: "admin",
          token,
          expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14),
          divisionIds: divisions.map((d) => d.id),
        },
      });
      const base = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
      console.log(
        `No SEED_ADMIN_PASSWORD — invite (accept-invite is stub): ${base}/accept-invite?token=${token}`,
      );
    }
  }

  console.log("Seeding material units…");
  const units = [
    { code: "EACH", name: "Each" },
    { code: "FT", name: "Foot" },
    { code: "BOX", name: "Box" },
    { code: "ROLL", name: "Roll" },
  ];
  for (const u of units) {
    await prisma.materialUnit.upsert({
      where: { code: u.code },
      create: u,
      update: { name: u.name, isActive: true },
    });
    console.log(`  ✓ ${u.code}`);
  }

  console.log("Seeding Stripe tax codes…");
  const taxCount = await seedStripeTaxCodes(prisma);
  console.log(`  ✓ ${taxCount} StripeTaxCode rows + labor defaults`);

  console.log("Syncing category tax profiles from Stripe codes…");
  const categories = await prisma.materialCategory.findMany({
    select: { id: true, stripeTaxCodeId: true, taxProfile: true },
  });
  let profilesUpdated = 0;
  for (const cat of categories) {
    const next = deriveTaxProfileFromStripeCode(cat.stripeTaxCodeId);
    if (cat.taxProfile !== next) {
      await prisma.materialCategory.update({
        where: { id: cat.id },
        data: { taxProfile: next },
      });
      profilesUpdated += 1;
    }
  }
  const itemsCleared = await prisma.materialItem.updateMany({
    where: { taxProfile: { not: null } },
    data: { taxProfile: null },
  });
  console.log(
    `  ✓ ${profilesUpdated} categories re-derived; ${itemsCleared.count} item overrides cleared`,
  );

  console.log("Syncing material attribute lists…");
  const attrSync = await syncAttributeLists(prisma);
  console.log(
    `  ✓ ${attrSync.attributesUpserted} attributes, ${attrSync.optionsUpserted} options` +
      (attrSync.attributesDeleted.length
        ? `; deleted ${attrSync.attributesDeleted.join(", ")}`
        : "") +
      (attrSync.attributesDeactivated.length
        ? `; deactivated ${attrSync.attributesDeactivated.join(", ")}`
        : ""),
  );

  console.log("Ensuring core category attribute assignments…");
  const coreAssign = await ensureCoreAssignmentsForAllCategories(prisma);
  console.log(
    `  ✓ manufacturer + part_number on ${coreAssign.categoriesUpdated} categories`,
  );

  console.log("Seeding labor rates (IS-Com, IS-Res, Cabin)…");
  await seedLaborRates(prisma);
  console.log("  ✓ 3 LaborRateConfig + 13 LaborPosition rows");

  console.log("Seeding complexity multipliers (IS-Com, IS-Res, Cabin)…");
  await seedComplexityMultipliers(prisma);
  console.log("  ✓ 46 ComplexityMultiplier rows (10 + 16 + 20)");

  console.log("Seeding IS-Commercial recurring fees…");
  await seedRecurringFees(prisma);
  console.log("  ✓ 11 RecurringFeeItem rows");

  console.log("Seeding Cabin Services plan rates…");
  await seedServicePlans(prisma);
  console.log("  ✓ 18 ServicePlanRate rows (MP/CIP/FSP)");

  console.log("Seeding role capabilities…");
  await seedCapabilities(prisma);
  console.log("  ✓ Capability catalog + role matrix");

  console.log("Seed complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
