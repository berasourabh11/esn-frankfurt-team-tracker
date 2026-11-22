import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";

import { eventKeys } from "@/services/eventKeys";
import { getEvents } from "@/services/events.server";

/** Prefetches the event list on the server and returns a dehydrated TanStack Query state. */
async function getDehydratedEventsState() {
  const queryClient = new QueryClient();
  // prefetchQuery never throws: if the backend fails, the state simply has no data.
  await queryClient.prefetchQuery({ queryKey: eventKeys.all, queryFn: getEvents });
  return dehydrate(queryClient);
}

/**
 * Hands the server-loaded events to the client-side TanStack Query cache, so
 * client components (feed, calendar, subscription) read them synchronously.
 * If loading fails, children still render and show an "unavailable" state.
 */
export async function EventsHydration({ children }: { children: React.ReactNode }) {
  const state = await getDehydratedEventsState();
  return <HydrationBoundary state={state}>{children}</HydrationBoundary>;
}
