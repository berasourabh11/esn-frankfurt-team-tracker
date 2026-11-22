import type { MetadataRoute } from "next";

import { siteConfig } from "@/lib/site";
import { getEvents } from "@/services/events.server";

// Always lists the current events.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const events = await getEvents();
  return [
    { url: `${siteConfig.url}/`, changeFrequency: "daily", priority: 1 },
    { url: `${siteConfig.url}/calendar`, changeFrequency: "daily", priority: 0.8 },
    ...events.map((event) => ({
      url: `${siteConfig.url}/events/${event.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}
