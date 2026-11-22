/** Public site configuration. Only NEXT_PUBLIC_* values are read here. */
export const siteConfig = {
  name: "ESN Frankfurt Events",
  shortName: "ESN Frankfurt",
  description:
    "Discover events, meet new people and make the most of your student life in Frankfurt with the Erasmus Student Network.",
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, ""),
  /**
   * Public iCalendar feed for Google/Apple/Outlook subscriptions. Defaults to
   * the API's feed (NEXT_PUBLIC_API_BASE_URL + /api/calendar.ics).
   */
  calendarFeedUrl:
    process.env.NEXT_PUBLIC_CALENDAR_FEED_URL?.trim() ||
    (process.env.NEXT_PUBLIC_API_BASE_URL?.trim()
      ? `${process.env.NEXT_PUBLIC_API_BASE_URL.trim().replace(/\/+$/, "")}/api/calendar.ics`
      : null),
  locale: "en_GB",
} as const;
