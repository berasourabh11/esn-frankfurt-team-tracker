import { describe, expect, it } from "vitest";

import { makeEvent } from "@/test/factories";

import {
  buildIcsCalendar,
  escapeIcsText,
  foldLine,
  getEventIcsTimes,
  getGoogleCalendarUrl,
} from "./ics";

describe("getEventIcsTimes", () => {
  it("creates all-day events with an exclusive end", () => {
    expect(getEventIcsTimes(makeEvent({ startDate: "2026-11-20" }))).toEqual({
      allDay: true,
      start: "20261120",
      end: "20261121",
    });
    expect(
      getEventIcsTimes(makeEvent({ startDate: "2026-11-12", endDate: "2026-11-15" })),
    ).toMatchObject({ start: "20261112", end: "20261116" });
  });

  it("creates timed events and assumes two hours when no end is known", () => {
    expect(
      getEventIcsTimes(
        makeEvent({ startDate: "2026-11-20", startTime: "18:00", endTime: "20:00" }),
      ),
    ).toEqual({ allDay: false, start: "20261120T180000", end: "20261120T200000" });
    expect(getEventIcsTimes(makeEvent({ startDate: "2026-11-20", startTime: "23:00" }))).toEqual({
      allDay: false,
      start: "20261120T230000",
      end: "20261121T010000",
    });
  });
});

describe("buildIcsCalendar", () => {
  it("produces a valid calendar with Berlin timezone and CRLF line endings", () => {
    const ics = buildIcsCalendar(
      [
        makeEvent({ slug: "dance", title: "Dance, Night; Fun", startTime: "18:00" }),
        makeEvent({ slug: "gone", status: "cancelled" }),
      ],
      { now: new Date("2026-11-20T10:00:00Z"), siteUrl: "https://events.example.org" },
    );
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
    expect(ics).toContain("BEGIN:VTIMEZONE\r\nTZID:Europe/Berlin");
    expect(ics).toContain("DTSTART;TZID=Europe/Berlin:20261120T180000");
    expect(ics).toContain("SUMMARY:Dance\\, Night\\; Fun");
    expect(ics).toContain("DTSTAMP:20261120T100000Z");
    expect(ics).toContain("URL:https://events.example.org/events/dance");
    expect(ics).not.toContain("UID:gone@");
    expect(ics.split("\r\n").every((line) => new TextEncoder().encode(line).length <= 75)).toBe(
      true,
    );
  });
});

describe("helpers", () => {
  it("escapes text", () => {
    expect(escapeIcsText("a,b;c\\d\ne")).toBe("a\\,b\\;c\\\\d\\ne");
  });

  it("folds long lines", () => {
    const folded = foldLine(`DESCRIPTION:${"x".repeat(100)}`);
    expect(folded.split("\r\n ")).toHaveLength(2);
  });

  it("builds Google Calendar links with the Berlin timezone", () => {
    const url = new URL(
      getGoogleCalendarUrl(
        makeEvent({ title: "Ice Skating", startTime: "19:00", location: "Eissporthalle" }),
      ),
    );
    expect(url.searchParams.get("text")).toBe("Ice Skating");
    expect(url.searchParams.get("ctz")).toBe("Europe/Berlin");
    expect(url.searchParams.get("location")).toBe("Eissporthalle");
  });
});
