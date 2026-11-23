import { describe, expect, it } from "vitest";

import { EventSeriesSchema } from "@/types/event";

import {
  describeRecurrence,
  expandSeries,
  isSeriesDate,
  occurrenceDates,
  parseOccurrenceSlug,
  weekOfMonth,
} from "./recurrence";

const series = EventSeriesSchema.parse({
  id: "s_1",
  slug: "language-cafe",
  title: "Language Café",
  summary: "Practise languages over coffee.",
  description: "Practise languages over coffee.",
  category: "social",
  startDate: "2026-12-02",
  startTime: "19:00",
  recurrence: { frequency: "weekly", interval: 1, count: 4 },
});

describe("occurrenceDates", () => {
  it("repeats weekly and every few weeks", () => {
    expect(
      occurrenceDates({ frequency: "weekly", interval: 1 }, "2026-12-02", "2026-12-31"),
    ).toEqual(["2026-12-02", "2026-12-09", "2026-12-16", "2026-12-23", "2026-12-30"]);
    expect(
      occurrenceDates({ frequency: "weekly", interval: 2, count: 3 }, "2026-12-02", "2027-12-31"),
    ).toEqual(["2026-12-02", "2026-12-16", "2026-12-30"]);
  });

  it("stops at the end date, even past the horizon", () => {
    expect(
      occurrenceDates(
        { frequency: "weekly", interval: 1, until: "2026-12-16" },
        "2026-12-02",
        "2027-12-31",
      ),
    ).toEqual(["2026-12-02", "2026-12-09", "2026-12-16"]);
  });

  it("repeats monthly on the same weekday, using the last one for fifth weekdays", () => {
    // 2 Dec 2026 is the first Wednesday of December.
    expect(
      occurrenceDates(
        { frequency: "monthly", interval: 1, monthlyBy: "weekday", count: 3 },
        "2026-12-02",
        "2027-12-31",
      ),
    ).toEqual(["2026-12-02", "2027-01-06", "2027-02-03"]);
    // 30 Dec 2026 is the fifth (= last) Wednesday.
    expect(weekOfMonth("2026-12-30")).toBe(-1);
    expect(
      occurrenceDates(
        { frequency: "monthly", interval: 1, monthlyBy: "weekday", count: 3 },
        "2026-12-30",
        "2027-12-31",
      ),
    ).toEqual(["2026-12-30", "2027-01-27", "2027-02-24"]);
  });

  it("repeats monthly on the same day and skips months without it", () => {
    expect(
      occurrenceDates(
        { frequency: "monthly", interval: 1, monthlyBy: "day", count: 3 },
        "2027-01-31",
        "2027-12-31",
      ),
    ).toEqual(["2027-01-31", "2027-03-31", "2027-05-31"]);
  });
});

describe("series", () => {
  it("describes the rhythm in words", () => {
    expect(describeRecurrence(series.recurrence, series.startDate)).toBe(
      "Every week on Wednesday, 4 times",
    );
    expect(
      describeRecurrence(
        { frequency: "monthly", interval: 2, monthlyBy: "weekday", until: "2027-06-30" },
        "2026-12-30",
      ),
    ).toBe("Every 2 months on the last Wednesday, until 30 Jun 2027");
    expect(
      describeRecurrence({ frequency: "monthly", interval: 1, monthlyBy: "day" }, "2026-12-15"),
    ).toBe("Every month on the 15th");
  });

  it("expands into events with their own slugs, minus removed and stored dates", () => {
    const events = expandSeries(
      { ...series, excludedDates: ["2026-12-09"] },
      "2027-12-31",
      new Set(["2026-12-16"]),
    );
    expect(events.map((e) => e.slug)).toEqual([
      "language-cafe-2026-12-02",
      "language-cafe-2026-12-23",
    ]);
    expect(events[0]).toMatchObject({
      id: "s_1-2026-12-02",
      seriesId: "s_1",
      title: "Language Café",
      startTime: "19:00",
    });
    expect(parseOccurrenceSlug("language-cafe-2026-12-23")).toEqual({
      seriesSlug: "language-cafe",
      date: "2026-12-23",
    });
    expect(isSeriesDate(series, "2026-12-09", "2026-12-31")).toBe(true);
    expect(isSeriesDate(series, "2026-12-10", "2026-12-31")).toBe(false);
  });

  it("keeps the length of multi-day events", () => {
    const [first, second] = expandSeries({ ...series, endDate: "2026-12-04" }, "2026-12-31");
    expect(first).toMatchObject({ startDate: "2026-12-02", endDate: "2026-12-04" });
    expect(second).toMatchObject({ startDate: "2026-12-09", endDate: "2026-12-11" });
  });
});
