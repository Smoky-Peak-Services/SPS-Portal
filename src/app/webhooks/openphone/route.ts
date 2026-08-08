import { NextRequest, NextResponse } from "next/server";
import { processOpenPhoneWebhook } from "@/features/phone/openphone-webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Legacy Quo URL (old portal + current Quo config). Prefer keeping this path. */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const sig =
    req.headers.get("openphone-signature") ??
    req.headers.get("x-openphone-signature");
  const result = await processOpenPhoneWebhook(raw, sig);
  return NextResponse.json(result.body, { status: result.status });
}
