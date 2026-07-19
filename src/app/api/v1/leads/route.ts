import { NextResponse } from "next/server";
import { handleLeadIngest } from "@/features/ingress/lead-handler";

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, x-ingest-key, x-ingest-secret",
    },
  });
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const result = await handleLeadIngest(body, {
    ingestKey: req.headers.get("x-ingest-key"),
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
}
