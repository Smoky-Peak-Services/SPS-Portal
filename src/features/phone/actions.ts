"use server";

import { revalidatePath } from "next/cache";
import { isPiiConfigured, prismaPii } from "@/lib/prisma-pii";
import { requireCrmWrite } from "@/features/crm/authz";
import { dismissWhereForGroupKey } from "@/features/phone/group-key";
import { dismissPhoneNumberSchema } from "@/features/phone/schemas";

export type PhoneActionResult = { ok: true } | { ok: false; error: string };

/** Hide every event from a number so the Call Log stays clean. */
export async function dismissPhoneNumber(
  raw: unknown,
): Promise<PhoneActionResult> {
  await requireCrmWrite();
  if (!isPiiConfigured()) {
    return { ok: false, error: "PII database is not configured." };
  }
  let groupKey: string;
  try {
    ({ groupKey } = dismissPhoneNumberSchema.parse(
      typeof raw === "string" ? { groupKey: raw } : raw,
    ));
  } catch {
    return { ok: false, error: "Invalid number" };
  }
  try {
    const result = await prismaPii.phoneEvent.updateMany({
      where: dismissWhereForGroupKey(groupKey),
      data: { dismissed: true },
    });
    if (result.count === 0) {
      return { ok: false, error: "No matching call events found" };
    }
    revalidatePath("/call-log");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to dismiss",
    };
  }
}
