import { afterEach, describe, expect, it, vi } from "vitest";
import { formatDate } from "./date";

describe("formatDate", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns HH:mm for today", () => {
    vi.setSystemTime(new Date(2026, 4, 26, 10, 30));

    expect(formatDate(new Date(2026, 4, 26, 9, 5).getTime())).toBe("09:05");
  });

  it("returns 昨天 for yesterday", () => {
    vi.setSystemTime(new Date(2026, 4, 26, 10, 30));

    expect(formatDate(new Date(2026, 4, 25, 23, 59).getTime())).toBe("昨天");
  });

  it("returns MM-DD for earlier dates in the same year", () => {
    vi.setSystemTime(new Date(2026, 4, 26, 10, 30));

    expect(formatDate(new Date(2026, 4, 22, 8, 0).getTime())).toBe("05-22");
  });

  it("keeps YYYY-MM-DD for dates outside the current year", () => {
    vi.setSystemTime(new Date(2026, 4, 26, 10, 30));

    expect(formatDate(new Date(2025, 11, 31, 8, 0).getTime())).toBe("2025-12-31");
  });

  it("supports second timestamps and empty values", () => {
    vi.setSystemTime(new Date(2026, 4, 26, 10, 30));

    expect(formatDate(Math.floor(new Date(2026, 4, 26, 7, 8).getTime() / 1000))).toBe("07:08");
    expect(formatDate(undefined)).toBe("");
    expect(formatDate("")).toBe("");
  });
});
