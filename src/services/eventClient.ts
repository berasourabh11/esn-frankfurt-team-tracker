"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { PUBLIC_API_BASE_URL } from "@/lib/api";
import type { EsnEvent, EventFormValues } from "@/types/event";

import {
  applyEventChanges,
  createHttpEventAdminService,
  createLocalEventAdminService,
  findLocalSeriesEvent,
  type EventAdminService,
  type SeriesInput,
} from "./eventAdminService";
import { eventKeys } from "./eventKeys";
import { createHttpEventService } from "./eventService";

/**
 * Client access to the event list.
 *
 * The root layout prefetches events on the server and hydrates them into the
 * TanStack Query cache, so client components get data synchronously during
 * SSR and the first render. If the Spring Boot API is also reachable from
 * browsers (`NEXT_PUBLIC_API_BASE_URL`, with CORS enabled), stale
 * data is refreshed in the background, and event management goes to it.
 * Without it, events created/edited/removed in the team area are kept in
 * this browser and overlaid on the server data (demo mode).
 */

const EMPTY: EsnEvent[] = [];
const changesKey = [...eventKeys.all, "local-changes"] as const;

let adminService: EventAdminService | null = null;
export function getEventAdminService(): EventAdminService {
  adminService ??= PUBLIC_API_BASE_URL
    ? createHttpEventAdminService({ baseUrl: PUBLIC_API_BASE_URL })
    : createLocalEventAdminService();
  return adminService;
}

/** For tests: swap the implementation. */
export function setEventAdminService(next: EventAdminService | null) {
  adminService = next;
}

function useEventChanges() {
  return useQuery({
    queryKey: changesKey,
    queryFn: () => getEventAdminService().getChanges(),
    // Only read on the client (never during prerendering/SSR).
    enabled: typeof window !== "undefined" && !PUBLIC_API_BASE_URL,
    staleTime: Infinity,
  });
}

export function useEvents() {
  const query = useQuery({
    queryKey: eventKeys.all,
    queryFn: () => {
      if (!PUBLIC_API_BASE_URL) throw new Error("No public events API configured");
      return createHttpEventService({ baseUrl: PUBLIC_API_BASE_URL }).listEvents();
    },
    // Browser only: during prerendering the hydrated server data is used as is
    // (a staleness check would read the current time, which Next.js forbids there).
    enabled: typeof window !== "undefined" && Boolean(PUBLIC_API_BASE_URL),
    staleTime: 5 * 60 * 1000,
  });
  const { data: changes } = useEventChanges();
  const base = query.data ?? EMPTY;
  const events = useMemo(
    () => (changes ? applyEventChanges(base, changes) : base),
    [base, changes],
  );

  return {
    events,
    /** True when no data could be loaded at all (backend unreachable). */
    unavailable: query.data === undefined && !query.isFetching,
  };
}

export type ResolvedEvent =
  | { state: "ready"; event: EsnEvent }
  | { state: "loading"; event: EsnEvent | null }
  | { state: "removed"; event: null }
  | { state: "missing"; event: null };

/**
 * The event for an event page: the server-rendered version, with local
 * edits/removal applied, or a locally created event the server doesn't know.
 */
export function useResolvedEvent(slug: string, serverEvent: EsnEvent | null): ResolvedEvent {
  const { data: changes, isSuccess } = useEventChanges();
  const live = useQuery({
    queryKey: [...eventKeys.all, "detail", slug],
    queryFn: () => createHttpEventService({ baseUrl: PUBLIC_API_BASE_URL! }).getEventBySlug(slug),
    enabled: typeof window !== "undefined" && Boolean(PUBLIC_API_BASE_URL),
    staleTime: 30 * 1000,
  });

  // With the API, the browser's fresh copy wins over the (cached) server render,
  // so new, edited and removed events show correctly right away.
  if (PUBLIC_API_BASE_URL) {
    if (live.data) return { state: "ready", event: live.data };
    if (live.data === null) {
      return serverEvent ? { state: "removed", event: null } : { state: "missing", event: null };
    }
    if (live.isError && serverEvent) return { state: "ready", event: serverEvent };
    if (live.isError) return { state: "missing", event: null };
    return { state: "loading", event: serverEvent };
  }

  const local = changes;
  if (!local) {
    return serverEvent
      ? { state: isSuccess ? "ready" : "loading", event: serverEvent }
      : { state: "loading", event: null };
  }
  if (local.deleted.includes(slug)) return { state: "removed", event: null };
  const event =
    local.updated[slug] ??
    local.created.find((e) => e.slug === slug) ??
    serverEvent ??
    findLocalSeriesEvent(local, slug);
  return event ? { state: "ready", event } : { state: "missing", event: null };
}

/** Repeating events (their rules); the dates themselves come with `useEvents`. */
export function useSeries() {
  const query = useQuery({
    queryKey: [...eventKeys.all, "series"],
    queryFn: () => getEventAdminService().listSeries(),
    enabled: typeof window !== "undefined",
    staleTime: 5 * 60 * 1000,
  });
  return { series: query.data ?? [], isLoading: query.isPending };
}

export function useEventAdminMutations() {
  const queryClient = useQueryClient();
  const onSuccess = () => queryClient.invalidateQueries({ queryKey: eventKeys.all });
  // Series carry default hosts, which show up in the team info of each date.
  const onSeriesSuccess = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: eventKeys.all }),
      queryClient.invalidateQueries({ queryKey: ["team"] }),
    ]);
  const svc = () => getEventAdminService();

  return {
    createEvent: useMutation({
      mutationFn: (v: { values: EventFormValues; existingSlugs: readonly string[] }) =>
        svc().createEvent(v.values, v.existingSlugs),
      onSuccess,
    }),
    updateEvent: useMutation({
      mutationFn: (v: { current: EsnEvent; values: EventFormValues }) =>
        svc().updateEvent(v.current, v.values),
      onSuccess,
    }),
    deleteEvent: useMutation({
      mutationFn: (slug: string) => svc().deleteEvent(slug),
      onSuccess,
    }),
    createSeries: useMutation({
      mutationFn: (v: { input: SeriesInput; existingSlugs: readonly string[] }) =>
        svc().createSeries(v.input, v.existingSlugs),
      onSuccess: onSeriesSuccess,
    }),
    updateSeries: useMutation({
      mutationFn: (v: { id: string; input: SeriesInput }) => svc().updateSeries(v.id, v.input),
      onSuccess: onSeriesSuccess,
    }),
    deleteSeries: useMutation({
      mutationFn: (id: string) => svc().deleteSeries(id),
      onSuccess: onSeriesSuccess,
    }),
  };
}
