import { describe, expect, it } from "vitest";

import { makeEvent } from "@/test/factories";

import {
  applyFilters,
  EMPTY_FILTERS,
  getPresetRange,
  hasActiveFilters,
  parseFilters,
  serializeFilters,
} from "./filters";

const today = "2026-11-20"; // Friday

describe("parseFilters / serializeFilters", () => {
  it("round-trips valid filters", () => {
    const filters = {
      query: "dance",
      categories: ["parties", "sports"] as const,
      date: "next-week" as const,
      on: null,
    };
    const params = serializeFilters({ ...filters, categories: [...filters.categories] });
    expect(params.toString()).toBe("q=dance&category=parties%2Csports&date=next-week");
    expect(parseFilters(params)).toEqual({ ...filters, categories: ["parties", "sports"] });
  });

  it("ignores invalid values", () => {
    const parsed = parseFilters(
      new URLSearchParams("category=parties,unknown,parties&date=yesterday&on=20-11-2026"),
    );
    expect(parsed).toEqual({ ...EMPTY_FILTERS, categories: ["parties"] });
  });

  it("omits defaults from the URL", () => {
    expect(serializeFilters(EMPTY_FILTERS).toString()).toBe("");
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false);
  });

  it("prefers a specific day over a preset", () => {
    const params = serializeFilters({ ...EMPTY_FILTERS, date: "today", on: "2026-12-03" });
    expect(params.toString()).toBe("on=2026-12-03");
  });
});

describe("getPresetRange", () => {
  it.each([
    ["today", { from: "2026-11-20", to: "2026-11-20" }],
    ["tomorrow", { from: "2026-11-21", to: "2026-11-21" }],
    ["weekend", { from: "2026-11-21", to: "2026-11-22" }],
    ["this-week", { from: "2026-11-20", to: "2026-11-22" }],
    ["next-week", { from: "2026-11-23", to: "2026-11-29" }],
    ["this-month", { from: "2026-11-20", to: "2026-11-30" }],
  ] as const)("%s", (preset, range) => {
    expect(getPresetRange(preset, today)).toEqual(range);
  });
});

describe("applyFilters", () => {
  const events = [
    makeEvent({ title: "Kiosk Crawl", category: "parties", startDate: "2026-11-20" }),
    makeEvent({ title: "Ice Skating", category: "sports", startDate: "2026-11-26" }),
    makeEvent({
      title: "Christmas Market",
      category: "cultural",
      startDate: "2026-12-03",
      location: "Römerberg",
    }),
    makeEvent({
      title: "Berlin Trip",
      category: "trips",
      startDate: "2026-11-19",
      endDate: "2026-11-22",
    }),
  ];
  const titles = (filters: Parameters<typeof applyFilters>[1]) =>
    applyFilters(events, filters, today).map((e) => e.title);

  it("searches by name, case-insensitively", () => {
    expect(titles({ ...EMPTY_FILTERS, query: "ICE" })).toEqual(["Ice Skating"]);
  });

  it("searches ignoring diacritics, including location", () => {
    expect(titles({ ...EMPTY_FILTERS, query: "romerberg" })).toEqual(["Christmas Market"]);
  });

  it("filters by multiple categories", () => {
    expect(titles({ ...EMPTY_FILTERS, categories: ["sports", "cultural"] })).toEqual([
      "Ice Skating",
      "Christmas Market",
    ]);
  });

  it("filters by date preset, including multi-day overlap", () => {
    expect(titles({ ...EMPTY_FILTERS, date: "weekend" })).toEqual(["Berlin Trip"]);
  });

  it("filters by a specific day", () => {
    expect(titles({ ...EMPTY_FILTERS, on: "2026-12-03" })).toEqual(["Christmas Market"]);
  });

  it("combines filters and can return nothing", () => {
    expect(titles({ ...EMPTY_FILTERS, query: "kiosk", categories: ["sports"] })).toEqual([]);
  });
});
