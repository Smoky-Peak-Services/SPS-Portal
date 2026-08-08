/**
 * Send a Quo test event and print delivery HTTP status (redacted).
 * Usage: npx tsx --env-file=.env.local scripts/verify-quo-webhook.ts [webhookId] [eventType]
 */
const key = (process.env.OP_API_KEY ?? process.env.OPENPHONE_API_KEY ?? "").trim();
const webhookId = process.argv[2] ?? "35296";
const eventType = process.argv[3] ?? "message.received";

async function main() {
  if (!key) {
    console.error("OP_API_KEY missing");
    process.exit(1);
  }

  const testRes = await fetch(
    `https://api.quo.com/webhooks/${webhookId}/events/test`,
    {
      method: "POST",
      headers: {
        Authorization: key,
        "Content-Type": "application/json",
        "Quo-Api-Version": "2026-03-30",
      },
      body: JSON.stringify({ eventType }),
    },
  );
  console.log("test request:", testRes.status);
  console.log((await testRes.text()).slice(0, 400));

  await new Promise((r) => setTimeout(r, 4000));

  const listRes = await fetch(
    `https://api.quo.com/webhooks/${webhookId}/events`,
    {
      headers: {
        Authorization: key,
        "Quo-Api-Version": "2026-03-30",
      },
    },
  );
  const list = (await listRes.json()) as {
    data?: Array<{ id: string; eventType?: string; status?: string; createdAt?: string }>;
  };

  for (const row of (list.data ?? []).slice(0, 5)) {
    const detailRes = await fetch(
      `https://api.quo.com/webhooks/${webhookId}/events/${row.id}`,
      {
        headers: {
          Authorization: key,
          "Quo-Api-Version": "2026-03-30",
        },
      },
    );
    const detail = (await detailRes.json()) as {
      data?: {
        attempts?: Array<{
          responseStatusCode?: number;
          responseBody?: string;
          status?: string;
        }>;
      };
    };
    const attempt = detail.data?.attempts?.[0];
    console.log(
      [
        row.createdAt ?? "?",
        row.eventType ?? "?",
        `status=${row.status ?? "?"}`,
        `http=${attempt?.responseStatusCode ?? "?"}`,
        `body=${(attempt?.responseBody ?? "").slice(0, 160)}`,
      ].join(" | "),
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
