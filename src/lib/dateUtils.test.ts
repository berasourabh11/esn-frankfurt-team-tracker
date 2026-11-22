import { describe, expect, it } from "vitest";

import { makeEvent } from "@/test/factories";

import {
  formatEventDateRange,
  formatRelativeDay,
  formatTimeRange,
  getBerlinToday,
  getTimeGroup,
  getWeekendRange,
  groupUpcomingEvents,
  isUpcoming,
  sortEvents,
  toBerlinDateTime,
} from "./dateUtils";

describe("getBerlinToday", () => {
  it("uses the Berlin calendar day, not UTC", () => {
    // 23:30 UTC on 20 Nov is already 00:30 on 21 Nov in Berlin (CET, UTC+1).
    expect(getBerlinToday(new Date("2026-11-20T23:30:00Z"))).toBe("2026-11-21");
    expect(getBerlinToday(new Date("2026-11-20T22:59:00Z"))).toBe("2026-11-20");
  });

  it("handles summer time (CEST, UTC+2)", () => {
    expect(getBerlinToday(new Date("2026-07-01T22:30:00Z"))).toBe("2026-07-02");
  });
});

describe("toBerlinDateTime", () => {
  it("adds the correct offset in winter and summer", () => {
    expect(toBerlinDateTime("2026-11-20", "18:00")).toBe("2026-11-20T18:00:00+01:00");
    expect(toBerlinDateTime("2026-07-01", "18:00")).toBe("2026-07-01T18:00:00+02:00");
  });
});

describe("getTimeGroup", () => {
  // Friday, 20 November 2026
  const today = "2026-11-20";

  it.each([
    ["2026-11-20", "today"],
    ["2026-11-21", "tomorrow"],
    ["2026-11-22", "this-week"], // Sunday closes the Monday-based week
    ["2026-11-23", "next-week"], // next Monday
    ["2026-11-29", "next-week"],
    ["2026-11-30", "later"],
  ] as const)("puts %s into %s", (date, group) => {
    expect(getTimeGroup({ startDate: date }, today)).toBe(group);
  });

  it("treats ongoing multi-day events as today", () => {
    expect(getTimeGroup({ startDate: "2026-11-18", endDate: "2026-11-22" }, today)).toBe("today");
  });

  it("on a Sunday, tomorrow is the next week's Monday and wins over next-week", () => {
    expect(getTimeGroup({ startDate: "2026-11-23" }, "2026-11-22")).toBe("tomorrow");
    expect(getTimeGroup({ startDate: "2026-11-24" }, "2026-11-22")).toBe("next-week");
  });
});

describe("groupUpcomingEvents", () => {
  it("drops past events, sorts chronologically and keeps group order", () => {
    const events = [
      makeEvent({ title: "Later", startDate: "2027-01-10" }),
      makeEvent({ title: "Past", startDate: "2026-11-01" }),
      makeEvent({ title: "Tomorrow", startDate: "2026-11-21" }),
      makeEvent({ title: "Today late", startDate: "2026-11-20", startTime: "21:00" }),
      makeEvent({ title: "Today early", startDate: "2026-11-20", startTime: "09:00" }),
    ];
    const groups = groupUpcomingEvents(events, "2026-11-20");
    expect(groups.map((g) => g.id)).toEqual(["today", "tomorrow", "later"]);
    expect(groups[0].events.map((e) => e.title)).toEqual(["Today early", "Today late"]);
    expect(groups.flatMap((g) => g.events).some((e) => e.title === "Past")).toBe(false);
  });
});

describe("sortEvents", () => {
  it("orders by date, then known times before TBA, then title", () => {
    const sorted = sortEvents([
      makeEvent({ title: "B", startDate: "2026-12-01" }),
      makeEvent({ title: "A", startDate: "2026-12-01" }),
      makeEvent({ title: "Timed", startDate: "2026-12-01", startTime: "18:00" }),
      makeEvent({ title: "Earlier day", startDate: "2026-11-30" }),
    ]);
    expect(sorted.map((e) => e.title)).toEqual(["Earlier day", "Timed", "A", "B"]);
  });
});

describe("isUpcoming", () => {
  it("keeps multi-day events until their last day", () => {
    const trip = { startDate: "2026-11-12", endDate: "2026-11-15" };
    expect(isUpcoming(trip, "2026-11-15")).toBe(true);
    expect(isUpcoming(trip, "2026-11-16")).toBe(false);
  });
});

describe("formatting", () => {
  it("formats time ranges", () => {
    expect(formatTimeRange({ startTime: "18:00", endTime: "20:00" })).toBe("18:00 – 20:00");
    expect(formatTimeRange({ startTime: "16:00" })).toBe("From 16:00");
    expect(formatTimeRange({})).toBeNull();
  });

  it("formats single and multi-day dates", () => {
    expect(formatEventDateRange({ startDate: "2026-11-20" })).toBe("Fri, 20 Nov");
    expect(formatEventDateRange({ startDate: "2026-11-12", endDate: "2026-11-15" })).toBe(
      "Thu, 12 Nov – Sun, 15 Nov",
    );
  });

  it("gives friendly relative days", () => {
    expect(formatRelativeDay({ startDate: "2026-11-20" }, "2026-11-20")).toBe("Today");
    expect(formatRelativeDay({ startDate: "2026-11-21" }, "2026-11-20")).toBe("Tomorrow");
    expect(formatRelativeDay({ startDate: "2026-11-23" }, "2026-11-20")).toBe("In 3 days");
    expect(formatRelativeDay({ startDate: "2026-12-20" }, "2026-11-20")).toBeNull();
    expect(
      formatRelativeDay({ startDate: "2026-11-19", endDate: "2026-11-21" }, "2026-11-20"),
    ).toBe("Happening now");
  });
});

describe("getWeekendRange", () => {
  it("returns the coming Saturday and Sunday", () => {
    expect(getWeekendRange("2026-11-18")).toEqual({ from: "2026-11-21", to: "2026-11-22" });
  });
  it("starts from today when it is already the weekend", () => {
    expect(getWeekendRange("2026-11-22")).toEqual({ from: "2026-11-22", to: "2026-11-22" });
  });
});
