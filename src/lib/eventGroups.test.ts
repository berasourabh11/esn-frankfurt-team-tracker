import { describe, expect, it } from "vitest";

import { applyEventChanges, EMPTY_CHANGES } from "@/services/eventAdminService";
import { makeEvent } from "@/test/factories";

import {
  countSubEvents,
  getParentCandidates,
  getParentEvent,
  getSubEvents,
  withoutDanglingParents,
} from "./eventGroups";

const weekend = makeEvent({ slug: "criminalp", title: "CriminaLP", endDate: "2026-11-22" });
const mystery = makeEvent({
  slug: "murder-mystery",
  title: "Murder Mystery",
  startDate: "2026-11-22",
  parentSlug: "criminalp",
});
const crawl = makeEvent({ slug: "kiosk-crawl", title: "Kiosk Crawl", parentSlug: "criminalp" });
const dinner = makeEvent({ slug: "dinner", title: "Dinner" });
const events = [weekend, mystery, crawl, dinner];

describe("event groups", () => {
  it("finds sub-events in date order and their main event", () => {
    expect(getSubEvents(events, "criminalp").map((e) => e.slug)).toEqual([
      "kiosk-crawl",
      "murder-mystery",
    ]);
    expect(getParentEvent(events, mystery)?.title).toBe("CriminaLP");
    expect(getParentEvent(events, dinner)).toBeUndefined();
    expect(countSubEvents(events).get("criminalp")).toBe(2);
  });

  it("offers only one level of nesting", () => {
    // A new event can go under any main or stand-alone event.
    expect(getParentCandidates(events).map((e) => e.slug)).toEqual(["criminalp", "dinner"]);
    // Not under itself, and not under a sub-event.
    expect(getParentCandidates(events, dinner).map((e) => e.slug)).toEqual(["criminalp"]);
    // An event with sub-events can't become a sub-event.
    expect(getParentCandidates(events, weekend)).toEqual([]);
  });

  it("forgets the main event once it is removed", () => {
    expect(withoutDanglingParents([mystery, dinner])[0].parentSlug).toBeUndefined();
    const merged = applyEventChanges(events, { ...EMPTY_CHANGES, deleted: ["criminalp"] });
    expect(merged.find((e) => e.slug === "murder-mystery")?.parentSlug).toBeUndefined();
  });
});
