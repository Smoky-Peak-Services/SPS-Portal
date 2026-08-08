import { NextRequest, NextResponse } from "next/server";
import {
  headersFromRequest,
  processOpenPhoneWebhook,
} from "@/features/phone/openphone-webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Quo webhook URL (legacy path used in Quo config). */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const result = await processOpenPhoneWebhook(raw, headersFromRequest(req));
  return NextResponse.json(result.body, { status: result.status });
}
