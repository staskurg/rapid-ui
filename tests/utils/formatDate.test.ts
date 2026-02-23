/**
 * formatDateForDisplay tests.
 * Verifies non-date values return null; ISO strings and dates format correctly.
 */
import { describe, it, expect } from "vitest";
import { formatDateForDisplay } from "@/lib/utils/formatDate";

describe("formatDateForDisplay", () => {
  it("returns null for non-date values", () => {
    expect(formatDateForDisplay("1")).toBeNull();
    expect(formatDateForDisplay("2001")).toBeNull();
    expect(formatDateForDisplay("sample-1")).toBeNull();
    expect(formatDateForDisplay("")).toBeNull();
    expect(formatDateForDisplay(null)).toBeNull();
    expect(formatDateForDisplay(undefined)).toBeNull();
    expect(formatDateForDisplay(true)).toBeNull();
    expect(formatDateForDisplay({})).toBeNull();
  });

  it("formats ISO date-time strings", () => {
    const result = formatDateForDisplay("2026-02-23T01:06:41Z");
    expect(result).not.toBeNull();
    expect(result).toMatch(/Feb.*2026/);
    expect(result).toMatch(/\d{1,2}:\d{2}\s*(AM|PM)/);
  });

  it("formats ISO date-only strings with shorter format", () => {
    const result = formatDateForDisplay("2026-02-23");
    expect(result).not.toBeNull();
    expect(result).toMatch(/Feb 23, 2026/);
    expect(result).not.toMatch(/:/); // no time component
  });

  it("formats Unix timestamps (seconds)", () => {
    const result = formatDateForDisplay(1708643201); // 2024-02-23
    expect(result).not.toBeNull();
    expect(result).toMatch(/2024/);
  });

  it("formats Unix timestamps (milliseconds)", () => {
    const result = formatDateForDisplay(1708643201000);
    expect(result).not.toBeNull();
    expect(result).toMatch(/2024/);
  });
});
