import { DateTime } from "luxon";
import { company } from "@/config/company";

/** Format a JS Date in the company timezone (Luxon format tokens). */
export function formatInCompanyTz(
  date: Date | string | number,
  format: string,
): string {
  const dt =
    date instanceof Date
      ? DateTime.fromJSDate(date)
      : typeof date === "number"
        ? DateTime.fromMillis(date)
        : DateTime.fromISO(date);
  return dt.setZone(company.timezone).toFormat(format);
}

/** yyyy-MM-dd in company timezone — export filenames. */
export function todayStampInCompanyTz(date = new Date()): string {
  return formatInCompanyTz(date, "yyyy-MM-dd");
}

/** Hour 0–23 in company timezone (dashboard greeting). */
export function companyHour(date = new Date()): number {
  return DateTime.fromJSDate(date).setZone(company.timezone).hour;
}

/**
 * Relative label when recent; otherwise a company-tz calendar date.
 * Compute on the server and pass to client components (avoids hydration skew).
 */
export function formatRelativeInCompanyTz(
  date: Date | number,
  now = new Date(),
): string {
  const ms =
    (typeof date === "number" ? date : date.getTime()) - now.getTime();
  const agoMs = -ms;
  const s = agoMs / 1000;
  if (s < 60) return "just now";
  const m = s / 60;
  if (m < 60) return `${Math.floor(m)}m ago`;
  const h = m / 60;
  if (h < 24) return `${Math.floor(h)}h ago`;
  const d = h / 24;
  if (d < 7) return `${Math.floor(d)}d ago`;
  return formatInCompanyTz(
    typeof date === "number" ? date : date,
    "M/d/yyyy",
  );
}
