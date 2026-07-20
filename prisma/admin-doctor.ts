import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "../src/lib/prisma";

/**
 * Admin doctor — diagnose & repair the first-admin login after a DB reset.
 *
 *   Diagnose (read-only):  npm run db:admin-doctor
 *   Repair:                npm run db:admin-doctor -- --fix
 *
 * Repair guarantees SEED_ADMIN_EMAIL can sign in with SEED_ADMIN_PASSWORD.
 */
const authInstance = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: { enabled: true, disableSignUp: false },
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
});

const FIX = process.argv.includes("--fix");

async function setCredentialPassword(userId: string, password: string) {
  const ctx = (await authInstance.$context) as unknown as {
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

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL ?? "ryan.k@smokypeak.tech";
  const name = process.env.SEED_ADMIN_NAME ?? "Ryan";
  const password = process.env.SEED_ADMIN_PASSWORD;

  console.log("\n=== DIAGNOSIS ===");
  console.log(`SEED_ADMIN_EMAIL    : ${email}`);
  console.log(`SEED_ADMIN_PASSWORD : ${password ? "set" : "NOT SET"}`);

  const users = await prisma.user.findMany({
    select: { id: true, email: true, role: true, emailVerified: true },
    orderBy: { createdAt: "asc" },
  });
  console.log(`\nusers (${users.length}):`);
  for (const u of users)
    console.log(
      `  - ${u.email}  role=${u.role}  verified=${u.emailVerified}`,
    );

  const accounts = await prisma.account.findMany({
    select: { userId: true, providerId: true, password: true },
  });
  console.log(`\naccounts (${accounts.length}):`);
  for (const a of accounts)
    console.log(
      `  - userId=${a.userId}  provider=${a.providerId}  hasPassword=${!!a.password}`,
    );

  const invites = await prisma.invitation.findMany({
    select: { email: true, role: true, expiresAt: true },
  });
  console.log(`\ninvitations (${invites.length}):`);
  for (const i of invites)
    console.log(
      `  - ${i.email}  role=${i.role}  expires=${i.expiresAt.toISOString()}`,
    );

  const admin = users.find((u) => u.email === email);
  const adminCred =
    admin &&
    accounts.find(
      (a) =>
        a.userId === admin.id &&
        a.providerId === "credential" &&
        a.password,
    );
  console.log("\n=== VERDICT ===");
  if (admin && adminCred)
    console.log(
      `✓ ${email} exists with a credential — login should work with the right password.`,
    );
  else if (admin && !adminCred)
    console.log(
      `✗ ${email} exists but has NO credential password → 401. Run with --fix.`,
    );
  else console.log(`✗ ${email} does not exist → 401. Run with --fix.`);

  if (!FIX) {
    console.log("\n(read-only — re-run with --fix to repair)\n");
    return;
  }

  if (!password) {
    console.error(
      "\nCannot --fix: SEED_ADMIN_PASSWORD is not set in the environment.\n",
    );
    process.exit(1);
  }

  console.log("\n=== REPAIR ===");
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    await authInstance.api.signUpEmail({ body: { email, password, name } });
    console.log(`created user + credential: ${email}`);
  } else {
    await setCredentialPassword(user.id, password);
    console.log(`reset credential password: ${email}`);
  }

  user = await prisma.user.update({
    where: { email },
    data: { role: "admin", emailVerified: true },
  });
  console.log(`elevated to admin + emailVerified`);

  const divisions = await prisma.division.findMany();
  for (const div of divisions) {
    await prisma.divisionMembership.upsert({
      where: { userId_divisionId: { userId: user.id, divisionId: div.id } },
      update: {},
      create: { userId: user.id, divisionId: div.id },
    });
  }
  console.log(`joined ${divisions.length} division(s)`);

  const cleared = await prisma.invitation.deleteMany({ where: { email } });
  if (cleared.count)
    console.log(`removed ${cleared.count} stale invite(s) for ${email}`);

  console.log(`\n✓ ${email} can now sign in with SEED_ADMIN_PASSWORD.\n`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
