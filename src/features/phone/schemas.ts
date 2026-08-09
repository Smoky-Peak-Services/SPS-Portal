import { z } from "zod";

/** Call Log dismiss — 10-digit national or PhoneEvent id fallback. */
export const dismissPhoneNumberSchema = z.object({
  groupKey: z.string().min(1).max(64),
});

export type DismissPhoneNumberInput = z.infer<typeof dismissPhoneNumberSchema>;
