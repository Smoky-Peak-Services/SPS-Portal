/**
 * Push OP_WEBHOOK_SECRET from .env.local to Vercel production+preview.
 * Usage: npx tsx --env-file=.env.local scripts/sync-quo-webhook-secret-to-vercel.ts
 */
import { spawnSync } from "node:child_process";

const secret = (
  process.env.OP_WEBHOOK_SECRET ??
  process.env.OPENPHONE_WEBHOOK_SECRET ??
  ""
).trim();

if (!secret) {
  console.error("OP_WEBHOOK_SECRET missing in env");
  process.exit(1);
}
if (!secret.startsWith("whsec_")) {
  console.error("OP_WEBHOOK_SECRET does not look like a Quo whsec_ key");
  process.exit(1);
}

function run(cmd: string, args: string[], input?: string) {
  const res = spawnSync(cmd, args, {
    input,
    encoding: "utf8",
    shell: true,
  });
  if (res.stdout) process.stdout.write(res.stdout);
  if (res.stderr) process.stderr.write(res.stderr);
  return res.status ?? 1;
}

console.log("Removing old OP_WEBHOOK_SECRET from Vercel (production, preview)…");
for (const env of ["production", "preview"] as const) {
  run("npx", ["vercel", "env", "rm", "OP_WEBHOOK_SECRET", env, "-y"]);
}

console.log("Adding OP_WEBHOOK_SECRET…");
for (const env of ["production", "preview"] as const) {
  const code = run(
    "npx",
    ["vercel", "env", "add", "OP_WEBHOOK_SECRET", env],
    `${secret}\n`,
  );
  if (code !== 0) {
    console.error(`Failed to add OP_WEBHOOK_SECRET for ${env}`);
    process.exit(code);
  }
}

console.log("Done. Redeploy production so the new secret is live.");
console.log("  npx vercel --prod");
