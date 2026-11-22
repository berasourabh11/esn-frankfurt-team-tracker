import { afterEach, describe, expect, it, vi } from "vitest";

import { mockEvents } from "@/mocks/events";
import { EsnEventSchema } from "@/types/event";

import {
  createEventService,
  createHttpEventService,
  createMockEventService,
  EventServiceError,
  parseEventList,
} from "./eventService";

afterEach(() => vi.restoreAllMocks());

describe("mock data", () => {
  it("is fully valid against the event schema", () => {
    for (const event of mockEvents) {
      expect(EsnEventSchema.safeParse(event).success, event.slug).toBe(true);
    }
  });

  it("has unique ids and slugs", () => {
    const slugs = mockEvents.map((e) => e.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("contains no internal organiser notes", () => {
    const text = JSON.stringify(mockEvents).toLowerCase();
    for (const internal of ["guestlist", "budget", "let chris know", "voucher", "oc:"]) {
      expect(text).not.toContain(internal);
    }
  });
});

describe("createMockEventService", () => {
  it("lists events sorted chronologically and finds by slug", async () => {
    const service = createMockEventService();
    const events = await service.listEvents();
    const dates = events.map((e) => e.startDate);
    expect(dates).toEqual([...dates].sort());
    expect(await service.getEventBySlug(events[0].slug)).toEqual(events[0]);
    expect(await service.getEventBySlug("does-not-exist")).toBeNull();
  });
});

describe("parseEventList", () => {
  const valid = {
    id: "a",
    slug: "a",
    title: "A",
    summary: "s",
    description: "d",
    category: "social",
    startDate: "2026-11-20",
  };

  it("accepts arrays and Spring Data pages", () => {
    expect(parseEventList([valid])).toHaveLength(1);
    expect(parseEventList({ content: [valid], totalElements: 1 })).toHaveLength(1);
  });

  it("skips invalid items instead of failing the whole list", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = parseEventList([valid, { ...valid, slug: "Not A Slug" }]);
    expect(result).toHaveLength(1);
    expect(console.warn).toHaveBeenCalledOnce();
  });

  it("rejects unexpected payloads", () => {
    expect(() => parseEventList({ events: [] })).toThrow(EventServiceError);
  });
});

describe("createHttpEventService", () => {
  const event = mockEvents[0];

  it("calls the Spring Boot endpoints", async () => {
    const fetchImpl = vi.fn(async (url: RequestInfo | URL) => {
      const path = String(url);
      if (path.endsWith("/api/events")) return Response.json([event]);
      if (path.endsWith(`/api/events/${event.slug}`)) return Response.json(event);
      return new Response(null, { status: 404 });
    });
    const service = createHttpEventService({
      baseUrl: "https://api.example.org/",
      fetchImpl: fetchImpl as typeof fetch,
    });

    expect(await service.listEvents()).toHaveLength(1);
    expect((await service.getEventBySlug(event.slug))?.title).toBe(event.title);
    expect(await service.getEventBySlug("missing")).toBeNull();
    expect(fetchImpl).toHaveBeenCalledWith("https://api.example.org/api/events", expect.anything());
  });

  it("throws a typed error on server failures", async () => {
    const service = createHttpEventService({
      baseUrl: "https://api.example.org",
      fetchImpl: (async () => new Response(null, { status: 503 })) as typeof fetch,
    });
    await expect(service.listEvents()).rejects.toMatchObject({ status: 503 });
  });
});

describe("createEventService", () => {
  it("uses mock data when no backend is configured", async () => {
    const events = await createEventService({}).listEvents();
    expect(events.length).toBe(mockEvents.length);
  });
});
