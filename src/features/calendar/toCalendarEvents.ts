import type { EventInput } from "@fullcalendar/react";

import { getCategoryMeta } from "@/lib/categories";
import { addDaysIso, getEventEndDate, isMultiDay } from "@/lib/dateUtils";
import type { EsnEvent } from "@/types/event";

/**
 * Maps events to FullCalendar inputs. The calendar runs with timeZone "UTC"
 * and naive date strings, so Berlin wall-clock times are displayed exactly as
 * stored regardless of the viewer's own timezone.
 */
export function toCalendarEvents(events: readonly EsnEvent[]): EventInput[] {
  return events.map((event) => {
    const meta = getCategoryMeta(event.category);
    const timed = Boolean(event.startTime) && !isMultiDay(event);

    let end: string | undefined;
    if (!timed) {
      // All-day ends are exclusive.
      end = isMultiDay(event) ? addDaysIso(getEventEndDate(event), 1) : undefined;
    } else if (event.endTime) {
      const endDate =
        event.endTime <= event.startTime! ? addDaysIso(event.startDate, 1) : event.startDate;
      end = `${endDate}T${event.endTime}:00`;
    }

    return {
      id: event.id,
      title: event.title,
      start: timed ? `${event.startDate}T${event.startTime}:00` : event.startDate,
      end,
      allDay: !timed,
      color: meta.textColor,
      contrastColor: "#ffffff",
      className: event.status === "tentative" ? "esn-tentative" : undefined,
      extendedProps: { slug: event.slug, category: event.category, status: event.status },
    };
  });
}
