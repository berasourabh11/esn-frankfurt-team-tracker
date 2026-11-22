import { sortEvents } from "@/lib/dateUtils";
import { mockEvents } from "@/mocks/events";
import { EsnEventSchema, type EsnEvent } from "@/types/event";

/**
 * Data-access boundary between the UI and the event backend.
 *
 * UI code never talks to a data source directly. It goes through an
 * `EventService`, so switching from mock data to the Spring Boot REST API is a
 * configuration change (`EVENTS_API_BASE_URL`), not a UI rewrite.
 *
 * Expected Spring Boot endpoints:
 *   GET {base}/api/events          → EsnEvent[]  (or a Spring `Page` with `content`)
 *   GET {base}/api/events/{slug}   → EsnEvent    (404 when unknown)
 */
export interface EventService {
  listEvents(): Promise<EsnEvent[]>;
  getEventBySlug(slug: string): Promise<EsnEvent | null>;
}

export class EventServiceError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "EventServiceError";
  }
}

/** Validates each item independently so one bad record cannot take down the page. */
export function parseEventList(payload: unknown): EsnEvent[] {
  const items = Array.isArray(payload)
    ? payload
    : payload &&
        typeof payload === "object" &&
        Array.isArray((payload as { content?: unknown }).content)
      ? (payload as { content: unknown[] }).content
      : null;

  if (!items) throw new EventServiceError("Unexpected events payload: expected an array");

  const events: EsnEvent[] = [];
  for (const item of items) {
    const result = EsnEventSchema.safeParse(item);
    if (result.success) events.push(result.data);
    else console.warn("[eventService] Skipping invalid event", result.error.issues);
  }
  return sortEvents(events);
}

export function createMockEventService(source: unknown[] = mockEvents): EventService {
  const events = parseEventList(source);
  return {
    async listEvents() {
      return events;
    },
    async getEventBySlug(slug) {
      return events.find((e) => e.slug === slug) ?? null;
    },
  };
}

export interface HttpEventServiceOptions {
  baseUrl: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export function createHttpEventService({
  baseUrl,
  timeoutMs = 8000,
  fetchImpl = fetch,
}: HttpEventServiceOptions): EventService {
  const root = baseUrl.replace(/\/+$/, "");

  async function request(path: string): Promise<Response> {
    const response = await fetchImpl(`${root}${path}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    return response;
  }

  return {
    async listEvents() {
      const response = await request("/api/events");
      if (!response.ok) {
        throw new EventServiceError(`Failed to load events (${response.status})`, response.status);
      }
      return parseEventList(await response.json());
    },
    async getEventBySlug(slug) {
      const response = await request(`/api/events/${encodeURIComponent(slug)}`);
      if (response.status === 404) return null;
      if (!response.ok) {
        throw new EventServiceError(`Failed to load event (${response.status})`, response.status);
      }
      const result = EsnEventSchema.safeParse(await response.json());
      if (!result.success) throw new EventServiceError("Received an invalid event from the API");
      return result.data;
    },
  };
}

/**
 * Picks the implementation from (server-only) environment variables.
 * `EVENTS_API_BASE_URL` set → Spring Boot over HTTP; unset → mock data.
 */
export function createEventService(
  env: Record<string, string | undefined> = process.env,
): EventService {
  const baseUrl = env.EVENTS_API_BASE_URL?.trim();
  if (!baseUrl) return createMockEventService();
  const timeoutMs = Number(env.EVENTS_API_TIMEOUT_MS) || undefined;
  return createHttpEventService({ baseUrl, timeoutMs });
}
