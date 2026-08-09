import { NextResponse } from "next/server";
import { handleLeadIngest } from "@/features/ingress/lead-handler";
import {
  allowIngestRequest,
  ingestRateLimitKey,
} from "@/features/ingress/rate-limit";

const MAX_BODY_BYTES = 32_768;

function clientIp(req: Request): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip");
}

export async function POST(req: Request) {
  const lengthHeader = req.headers.get("content-length");
  if (!lengthHeader) {
    return NextResponse.json(
      { error: "Content-Length required" },
      { status: 413 },
    );
  }
  const contentLength = Number(lengthHeader);
  if (
    !Number.isFinite(contentLength) ||
    contentLength < 0 ||
    contentLength > MAX_BODY_BYTES
  ) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  const ingestKey = req.headers.get("x-ingest-key");
  const bucketKey = ingestRateLimitKey(ingestKey, clientIp(req));
  if (!allowIngestRequest(bucketKey)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const result = await handleLeadIngest(body, {
      ingestKey,
      ingestSecret: req.headers.get("x-ingest-secret"),
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }

    return NextResponse.json(
      { ok: true, leadId: result.leadId },
      { status: 201 },
    );
  } catch (err) {
    console.error(
      "[ingest] unhandled error:",
      err instanceof Error ? err.message : String(err),
    );
    return NextResponse.json({ error: "Ingest failed" }, { status: 500 });
  }
}
