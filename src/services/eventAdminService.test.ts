import { describe, expect, it } from "vitest";

import { makeEvent } from "@/test/factories";
import type { EventFormValues } from "@/types/event";

import {
  applyEventChanges,
  createLocalEventAdminService,
  createUniqueSeriesSlug,
  createUniqueSlug,
  EMPTY_CHANGES,
  eventFromForm,
} from "./eventAdminService";
import type { KeyValueStorage } from "./teamService";

const values: EventFormValues = {
  title: "Pub Quiz Night",
  summary: "Test your knowledge in teams.",
  category: "social",
  status: "scheduled",
  startDate: "2026-12-10",
  startTime: "19:30",
  location: "Waxy's",
};

function memoryStorage(): KeyValueStorage {
  const data = new Map<string, string>();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

describe("createUniqueSlug", () => {
  it("builds title-date slugs and avoids collisions", () => {
    expect(createUniqueSlug("Pub Quiz Night!", "2026-12-10", [])).toBe("pub-quiz-night-2026-12-10");
    expect(
      createUniqueSlug("Pub Quiz Night", "2026-12-10", [
        "pub-quiz-night-2026-12-10",
        "pub-quiz-night-2026-12-10-2",
      ]),
    ).toBe("pub-quiz-night-2026-12-10-3");
    expect(createUniqueSlug("💃", "2026-12-10", [])).toBe("event-2026-12-10");
  });
});

describe("eventFromForm", () => {
  it("defaults the description to the summary and drops same-day end dates", () => {
    const event = eventFromForm({ ...values, endDate: "2026-12-10" }, { id: "x", slug: "x" });
    expect(event.description).toBe(values.summary);
    expect(event.endDate).toBeUndefined();
    expect(event.tags).toEqual([]);
  });
});

describe("applyEventChanges", () => {
  const a = makeEvent({ slug: "a", startDate: "2026-12-01" });
  const b = makeEvent({ slug: "b", startDate: "2026-12-05" });

  it("returns server events unchanged when there are no changes", () => {
    expect(applyEventChanges([b, a], EMPTY_CHANGES).map((e) => e.slug)).toEqual(["a", "b"]);
  });

  it("applies edits, removals and new events, sorted by date", () => {
    const edited = { ...a, title: "Edited A" };
    const created = makeEvent({ slug: "c", startDate: "2026-11-30" });
    const result = applyEventChanges([a, b], {
      created: [created],
      updated: { a: edited },
      deleted: ["b"],
      series: [],
    });
    expect(result.map((e) => e.slug)).toEqual(["c", "a"]);
    expect(result[1].title).toBe("Edited A");
  });
});

describe("local event admin service", () => {
  it("creates, edits and removes events", async () => {
    const service = createLocalEventAdminService(memoryStorage());
    const server = [makeEvent({ slug: "server-event", startDate: "2026-12-01" })];

    const created = await service.createEvent(
      values,
      server.map((e) => e.slug),
    );
    expect(created.slug).toBe("pub-quiz-night-2026-12-10");

    const again = await service.createEvent(
      values,
      server.map((e) => e.slug),
    );
    expect(again.slug).toBe("pub-quiz-night-2026-12-10-2");

    await service.updateEvent(created, { ...values, title: "Quiz Night", startTime: undefined });
    await service.updateEvent(server[0], { ...values, title: "Renamed server event" });
    await service.deleteEvent(again.slug);

    const merged = applyEventChanges(server, await service.getChanges());
    expect(merged.map((e) => [e.slug, e.title])).toEqual([
      ["server-event", "Renamed server event"],
      ["pub-quiz-night-2026-12-10", "Quiz Night"],
    ]);
    expect(merged[1].startTime).toBeUndefined();

    await service.deleteEvent("server-event");
    const changes = await service.getChanges();
    expect(changes.deleted).toEqual(["server-event"]);
    expect(changes.updated["server-event"]).toBeUndefined();
    expect(applyEventChanges(server, changes).map((e) => e.slug)).toEqual([
      "pub-quiz-night-2026-12-10",
    ]);
  });
});

describe("repeating events (demo mode)", () => {
  const weekly = { frequency: "weekly", interval: 1, count: 3 } as const;
  const tandem = { ...values, title: "Tandem Evening", startDate: "2027-01-06" };

  it("avoids slugs whose dates would clash with existing events", () => {
    expect(createUniqueSeriesSlug("Tandem Evening", [], [])).toBe("tandem-evening");
    expect(createUniqueSeriesSlug("Tandem Evening", ["tandem-evening-2026-12-02"], [])).toBe(
      "tandem-evening-2",
    );
    expect(createUniqueSeriesSlug("Tandem Evening", [], ["tandem-evening"])).toBe(
      "tandem-evening-2",
    );
  });

  it("stores the series once and overlays its dates", async () => {
    const service = createLocalEventAdminService(memoryStorage());
    const first = await service.createSeries(
      { values: tandem, recurrence: weekly, hostIds: [] },
      [],
    );
    expect(first).toMatchObject({
      slug: "tandem-evening-2027-01-06",
      seriesId: "s-tandem-evening",
    });

    const changes = await service.getChanges();
    expect(changes.series).toHaveLength(1);
    expect(changes.created).toEqual([]);
    const slugs = () =>
      service.getChanges().then((c) => applyEventChanges([], c).map((e) => [e.slug, e.title]));
    expect(await slugs()).toEqual([
      ["tandem-evening-2027-01-06", "Tandem Evening"],
      ["tandem-evening-2027-01-13", "Tandem Evening"],
      ["tandem-evening-2027-01-20", "Tandem Evening"],
    ]);

    // One date changed, one removed: the others follow the series.
    const second = applyEventChanges([], await service.getChanges())[1];
    const edited = await service.updateEvent(second, { ...tandem, title: "Tandem: Spanish" });
    expect(edited.seriesId).toBe("s-tandem-evening");
    await service.deleteEvent("tandem-evening-2027-01-20");
    await service.updateSeries("s-tandem-evening", {
      values: { ...tandem, title: "Tandem & Tapas" },
      recurrence: weekly,
      hostIds: [],
    });
    expect(await slugs()).toEqual([
      ["tandem-evening-2027-01-06", "Tandem & Tapas"],
      ["tandem-evening-2027-01-13", "Tandem & Tapas"],
    ]);

    await service.deleteSeries("s-tandem-evening");
    const after = await service.getChanges();
    expect(applyEventChanges([], after)).toEqual([]);
    expect(after.deleted).toEqual([]);
  });
});
