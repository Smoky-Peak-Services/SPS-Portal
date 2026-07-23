import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  geoapifyConfigured,
  geoapifyValidateAddress,
} from "@/lib/geoapify";
import { isUsRegionCode } from "@/features/crm/us-regions";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json(
      { result: null, configured: false },
      { status: 401 },
    );
  }

  const sp = new URL(req.url).searchParams;
  const line1 = (sp.get("line1") ?? "").trim();
  const city = (sp.get("city") ?? "").trim();
  const postal = (sp.get("postal") ?? "").trim();
  const state = (sp.get("state") ?? "").trim().toUpperCase();

  if (!state || !isUsRegionCode(state)) {
    return NextResponse.json({
      result: null,
      configured: geoapifyConfigured(),
      error: "state_required",
    });
  }

  if (!line1) {
    return NextResponse.json({
      result: null,
      configured: geoapifyConfigured(),
      error: "line1_required",
    });
  }

  const result = await geoapifyValidateAddress(
    { line1, city, postal, region: state },
    state,
  );

  return NextResponse.json({
    result,
    configured: geoapifyConfigured(),
  });
}
