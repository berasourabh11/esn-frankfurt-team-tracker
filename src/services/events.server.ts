import "server-only";

import { cache } from "react";

import { createEventService, type EventService } from "./eventService";

/**
 * Server-only accessors used by Server Components, metadata and OG images.
 * Reading `process.env` here keeps the API address private.
 *
 * Events are loaded per request (React `cache` shares one load between the
 * page, its metadata and the layout), so edits show up immediately. The
 * service is created lazily: on Cloudflare, environment variables are only
 * available once a request is being handled.
 */
let service: EventService | null = null;
const getService = () => (service ??= createEventService());

export const getEvents = cache(async () => getService().listEvents());

export const getEventBySlug = cache(async (slug: string) => getService().getEventBySlug(slug));
