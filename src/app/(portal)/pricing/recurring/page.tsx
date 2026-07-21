import { redirect } from "next/navigation";

/** Bookmark-friendly redirect after Catalog move (prompt 12). */
export default function PricingRecurringRedirect() {
  redirect("/materials/recurring");
}
