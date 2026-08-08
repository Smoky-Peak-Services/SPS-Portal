/**
 * Register Quo webhooks for the SPS Portal Call Log.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/register-quo-webhooks.ts
 *   npx tsx --env-file=.env.local scripts/register-quo-webhooks.ts --test message.received
 *
 * Requires OP_API_KEY (or OPENPHONE_API_KEY). After success, copy the printed
 * whsec_… key to Vercel as OP_WEBHOOK_SECRET / OPENPHONE_WEBHOOK_SECRET.
 */
import {
  createQuoWebhook,
  sendQuoWebhookTestEvent,
} from "../src/lib/quo-api";

const DEFAULT_URL = "https://portal.smokypeak.tech/webhooks/openphone";

async function main() {
  const args = process.argv.slice(2);
  const testIdx = args.indexOf("--test");
  const testEvent =
    testIdx >= 0 ? (args[testIdx + 1] ?? "message.received") : null;
  const urlFlag = args.indexOf("--url");
  const url = urlFlag >= 0 ? args[urlFlag + 1] : (process.env.OP_API_WEBHOOK_URL ?? DEFAULT_URL);

  if (!url) {
    console.error("Missing webhook URL (--url or OP_API_WEBHOOK_URL)");
    process.exit(1);
  }

  console.log(`Registering Quo webhook → ${url}`);
  const result = await createQuoWebhook({ url });
  if (!result.ok) {
    console.error("Failed:", result.error);
    process.exit(1);
  }

  console.log("\nWebhook created:");
  console.log(`  id:     ${result.id}`);
  console.log(`  url:    ${result.url}`);
  console.log(`  events: ${result.events.join(", ")}`);
  console.log("\n*** Copy this signing key to Vercel (OP_WEBHOOK_SECRET) ***");
  console.log(result.key);
  console.log(
    "\nThen redeploy. Call Log fills from Quo deliveries; unknown callers stay Call Log-only until triage.\n",
  );

  if (testEvent) {
    console.log(`Sending test event: ${testEvent}`);
    const test = await sendQuoWebhookTestEvent(result.id, testEvent);
    if (!test.ok) {
      console.error("Test event failed:", test.error);
      process.exit(1);
    }
    console.log("Test event requested. Check Vercel logs + /call-log.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
