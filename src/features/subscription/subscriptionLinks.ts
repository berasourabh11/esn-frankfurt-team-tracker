/**
 * Builds calendar-app subscription links for a public iCalendar feed URL
 * (served by the backend). Accepts http(s):// or webcal:// input.
 */
export function getSubscriptionLinks(feedUrl: string, calendarName: string) {
  const withoutScheme = feedUrl.replace(/^(https?|webcal):\/\//i, "");
  const https = `https://${withoutScheme}`;
  const webcal = `webcal://${withoutScheme}`;

  return {
    https,
    webcal,
    google: `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}`,
    outlook: `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(
      https,
    )}&name=${encodeURIComponent(calendarName)}`,
  };
}
