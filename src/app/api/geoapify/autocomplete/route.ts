import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  geoapifyAutocomplete,
  geoapifyConfigured,
} from "@/lib/geoapify";
import { isUsRegionCode } from "@/features/crm/us-regions";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json(
      { results: [], configured: false },
      { status: 401 },
    );
  }

  const sp = new URL(req.url).searchParams;
  const text = sp.get("text") ?? "";
  const state = (sp.get("state") ?? "").trim().toUpperCase();

  if (!state || !isUsRegionCode(state)) {
    return NextResponse.json({
      results: [],
      configured: geoapifyConfigured(),
      error: "state_required",
    });
  }

  const results = await geoapifyAutocomplete(text, state);
  return NextResponse.json({
    results,
    configured: geoapifyConfigured(),
  });
}
