import { parseISO, isValid, format, fromUnixTime } from "date-fns";

/** Display format for dates (locale can be added later) */
const DISPLAY_FORMAT = "MMM d, yyyy, h:mm a";
const DISPLAY_FORMAT_DATE_ONLY = "MMM d, yyyy";

/**
 * Try to format a value as a date for display.
 * Returns null if the value is not a recognizable date.
 *
 * Supported now (simplified):
 * - ISO 8601 strings (date-time, date) via parseISO
 * - Unix timestamp (number, seconds or ms)
 *
 * Extensible later:
 * - formatHint from schema (date-time | date | time | unix-ts)
 * - Custom format strings (parse with date-fns parse)
 */
export function formatDateForDisplay(
  value: unknown,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- reserved for schema format hint
  _formatHint?: "date-time" | "date" | "time" | "unix-ts"
): string | null {
  if (value === null || value === undefined) return null;

  let date: Date;
  if (typeof value === "number") {
    // Unix timestamp: assume seconds if < 1e12, else ms
    const ms = value < 1e12 ? value * 1000 : value;
    date = fromUnixTime(Math.floor(ms / 1000));
  } else if (typeof value === "string") {
    // Require ISO 8601-like format to avoid false positives (e.g. "1", "2001", "sample-1")
    if (!/^\d{4}-\d{2}-\d{2}/.test(value.trim())) return null;
    date = parseISO(value);
  } else {
    return null;
  }

  if (!isValid(date)) return null;
  // For date-only values (no time component), use shorter format
  const hasTime = typeof value === "string" && value.includes("T");
  return format(date, hasTime ? DISPLAY_FORMAT : DISPLAY_FORMAT_DATE_ONLY);
}
