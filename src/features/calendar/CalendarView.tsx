"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import FullCalendar, { type CalendarRef, type DatesSetInfo } from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import interactionPlugin from "@fullcalendar/react/interaction";
import listPlugin from "@fullcalendar/react/list";
import enGbLocale from "@fullcalendar/react/locales/en-gb";
import breezyTheme from "@fullcalendar/react/themes/breezy";
import timeGridPlugin from "@fullcalendar/react/timegrid";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  List,
  NotebookPen,
  Rows3,
  UserRound,
} from "lucide-react";

import "@fullcalendar/react/skeleton.css";
import "@fullcalendar/react/themes/breezy/theme.css";
import "./calendar-theme.css";

import { DayAgenda } from "@/components/calendar/DayAgenda";
import { CategoryIcon } from "@/components/events/CategoryIcon";
import { useBerlinToday } from "@/hooks/useBerlinToday";
import { CATEGORY_LIST, getCategoryMeta } from "@/lib/categories";
import {
  formatMonthYear,
  occursOn,
  overlapsRange,
  sortEvents,
  type IsoDate,
} from "@/lib/dateUtils";
import { cn, pluralize } from "@/lib/utils";
import { useSession } from "@/features/auth/session";
import { formatHostNames } from "@/features/event-team/EventHosts";
import { useEvents } from "@/services/eventClient";
import { useEventInfos } from "@/services/teamClient";
import type { EventCategory, EventStatus } from "@/types/event";

import { EventQuickView } from "./EventQuickView";
import { toCalendarEvents } from "./toCalendarEvents";

const VIEWS = {
  month: { fc: "dayGridMonth", label: "Month", icon: CalendarDays },
  week: { fc: "timeGridWeek", label: "Week", icon: Rows3 },
  list: { fc: "listMonth", label: "List", icon: List },
} as const;
type ViewKey = keyof typeof VIEWS;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Formats FullCalendar's UTC-based markers back to our calendar dates. */
const markerToIso = (date: Date) => date.toISOString().slice(0, 10);

export function CalendarView({ initialToday }: { initialToday: IsoDate }) {
  const today = useBerlinToday(initialToday);
  const { events } = useEvents();
  const { member, members } = useSession();
  const { data: infos } = useEventInfos();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const calendarRef = useRef<CalendarRef>(null);
  const [hidden, setHidden] = useState<EventCategory[]>([]);
  const [openSlug, setOpenSlug] = useState<string | null>(null);

  const rawDate = searchParams.get("date");
  const selectedDate = rawDate && ISO_DATE_RE.test(rawDate) ? rawDate : today;
  const rawView = searchParams.get("view");
  const view: ViewKey = rawView && rawView in VIEWS ? (rawView as ViewKey) : "month";
  // Seeded so the heading is server-rendered; FullCalendar refines it via datesSet.
  const [title, setTitle] = useState(() => formatMonthYear(selectedDate));
  const [range, setRange] = useState<{ start: IsoDate; end: IsoDate } | null>(null);

  const updateUrl = useCallback(
    (next: { date?: IsoDate; view?: ViewKey }) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next.date) {
        if (next.date === today) params.delete("date");
        else params.set("date", next.date);
      }
      if (next.view) {
        if (next.view === "month") params.delete("view");
        else params.set("view", next.view);
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams, today],
  );

  const visibleEvents = useMemo(
    () => events.filter((e) => !hidden.includes(e.category)),
    [events, hidden],
  );
  const calendarEvents = useMemo(() => toCalendarEvents(visibleEvents), [visibleEvents]);
  const dayEvents = useMemo(
    () => visibleEvents.filter((e) => occursOn(e, selectedDate)),
    [visibleEvents, selectedDate],
  );
  const nextEvent = useMemo(
    () => sortEvents(visibleEvents).find((e) => e.startDate > selectedDate),
    [visibleEvents, selectedDate],
  );
  const inView = useMemo(
    () =>
      range
        ? visibleEvents.filter((e) => overlapsRange(e, { from: range.start, to: range.end })).length
        : null,
    [visibleEvents, range],
  );

  // Hosts (public, like the sheet's "OC" row) and team notes (signed-in team only).
  const details = useMemo(() => {
    const map = new Map<string, { hosts: string | null; notes: string }>();
    for (const info of infos ?? []) {
      map.set(info.eventSlug, {
        hosts: formatHostNames(info.hostIds, members),
        notes: member ? info.notes.trim() : "",
      });
    }
    return map;
  }, [infos, members, member]);

  const openEvent = openSlug ? (events.find((e) => e.slug === openSlug) ?? null) : null;

  // Keep the visible range in sync when the selected day moves outside it
  // (agenda prev/next buttons, "next event", back/forward navigation).
  useEffect(() => {
    const api = calendarRef.current?.getApi();
    if (!api) return;
    const current = api.view;
    const start = markerToIso(current.currentStart);
    const end = markerToIso(current.currentEnd); // exclusive
    if (selectedDate < start || selectedDate >= end) api.gotoDate(selectedDate);
  }, [selectedDate]);

  useEffect(() => {
    const api = calendarRef.current?.getApi();
    if (api && api.view.type !== VIEWS[view].fc) api.changeView(VIEWS[view].fc);
  }, [view]);

  const api = () => calendarRef.current?.getApi();

  function navigate(direction: "prev" | "next" | "today") {
    const calendar = api();
    if (!calendar) return;
    if (direction === "today") {
      calendar.today();
      updateUrl({ date: today });
      return;
    }
    calendar[direction]();
    // In month view, move the selection into the new month for a useful agenda.
    const start = markerToIso(calendar.view.currentStart);
    updateUrl({ date: start.slice(0, 7) === today.slice(0, 7) ? today : start });
  }

  function toggleCategory(category: EventCategory) {
    setHidden((h) => (h.includes(category) ? h.filter((c) => c !== category) : [...h, category]));
  }

  return (
    <div className="flex flex-col gap-6">
      <div
        className="esn-calendar overflow-hidden rounded-[2rem] border bg-card shadow-lg shadow-primary/5"
        aria-labelledby="calendar-title"
        role="region"
      >
        {/* Month header */}
        <div className="esn-calendar-header relative overflow-hidden px-4 py-5 text-white sm:px-6">
          <div className="relative flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <HeaderButton label="Previous" onClick={() => navigate("prev")}>
                  <ChevronLeft className="size-5" />
                </HeaderButton>
                <HeaderButton label="Next" onClick={() => navigate("next")}>
                  <ChevronRight className="size-5" />
                </HeaderButton>
              </div>
              <div>
                <h2
                  className="text-2xl leading-tight font-extrabold tracking-tight sm:text-3xl"
                  aria-live="polite"
                  id="calendar-title"
                >
                  {title}
                </h2>
                {inView !== null && (
                  <p className="text-sm font-medium text-white/80">
                    {inView ? pluralize(inView, "event") : "No events"}
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => navigate("today")}
                className="h-9 rounded-full bg-white px-4 text-sm font-bold text-primary shadow-sm transition hover:bg-white/90"
              >
                Today
              </button>
              <div
                role="group"
                aria-label="Calendar view"
                className="flex rounded-full bg-white/15 p-1 backdrop-blur"
              >
                {(Object.keys(VIEWS) as ViewKey[]).map((key) => {
                  const { label, icon: Icon } = VIEWS[key];
                  const active = key === view;
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={active}
                      onClick={() => updateUrl({ view: key })}
                      className={cn(
                        "flex h-7 items-center gap-1.5 rounded-full px-3 text-sm font-semibold transition",
                        active
                          ? "bg-white text-primary shadow-sm"
                          : "text-white/85 hover:text-white",
                      )}
                    >
                      <Icon className="size-4" aria-hidden="true" />
                      <span className="max-sm:sr-only">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="p-1.5 sm:p-3">
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin, breezyTheme]}
            locale={enGbLocale}
            initialView={VIEWS[view].fc}
            initialDate={selectedDate}
            timeZone="UTC"
            now={`${today}T12:00:00`}
            firstDay={1}
            headerToolbar={false}
            height="auto"
            fixedWeekCount={false}
            // The whole month at once: every event is shown, nothing hides behind "+2 more".
            dayMaxEvents={false}
            eventDisplay="block"
            nowIndicator={false}
            scrollTime="08:00:00"
            eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
            events={calendarEvents}
            noEventsText="No events in this period"
            datesSet={(info: DatesSetInfo) => {
              setTitle(info.view.title);
              const start = markerToIso(info.view.currentStart);
              const end = markerToIso(new Date(info.view.currentEnd.getTime() - 86_400_000));
              // Only on real changes: FullCalendar calls this again on re-renders.
              setRange((r) => (r?.start === start && r.end === end ? r : { start, end }));
            }}
            dateClick={(info) => updateUrl({ date: info.dateStr.slice(0, 10) })}
            eventClick={(info) => {
              info.jsEvent.preventDefault();
              setOpenSlug(info.event.extendedProps.slug as string);
            }}
            dayHeaderClass="esn-day-header"
            dayCellClass={(info) =>
              cn(
                "esn-day cursor-pointer",
                (info.dow === 0 || info.dow === 6) && "esn-weekend",
                info.isOther && "esn-other-month",
                info.isPast && !info.isToday && "esn-past",
                markerToIso(info.date) === selectedDate && "esn-selected-day",
              )
            }
            dayCellTopContent={(info) => (
              <span className={cn("esn-day-number", info.isToday && "esn-today-number")}>
                {info.dayNumberText}
              </span>
            )}
            eventClass="esn-event"
            eventContent={(info) => {
              const props = info.event.extendedProps as {
                slug: string;
                category: EventCategory;
                status: EventStatus;
              };
              const meta = getCategoryMeta(props.category);
              const extra = details.get(props.slug);
              const isMonth = info.view.type === "dayGridMonth";
              return (
                <span
                  className={cn(
                    "esn-chip",
                    props.status === "tentative" && "esn-chip-tentative",
                    props.status === "cancelled" && "esn-chip-cancelled",
                  )}
                  style={
                    {
                      "--chip": meta.color,
                      "--chip-text": meta.textColor,
                    } as React.CSSProperties
                  }
                  title={info.event.title}
                >
                  <span className="esn-chip-main">
                    <CategoryIcon category={props.category} className="esn-chip-icon" />
                    {info.timeText && <span className="esn-chip-time">{info.timeText}</span>}
                    <span className="esn-chip-title">{info.event.title}</span>
                  </span>
                  {isMonth && info.isStart && extra?.hosts && (
                    <span className="esn-chip-line">
                      <UserRound aria-hidden="true" />
                      <span>{extra.hosts}</span>
                    </span>
                  )}
                  {isMonth && info.isStart && extra?.notes && (
                    <span className="esn-chip-note">
                      <NotebookPen aria-hidden="true" />
                      <span>{extra.notes}</span>
                    </span>
                  )}
                </span>
              );
            }}
          />
        </div>

        {/* Legend doubles as a category filter */}
        <div
          role="group"
          aria-label="Show categories"
          className="flex [scrollbar-width:none] gap-1.5 overflow-x-auto border-t bg-muted/30 px-4 py-3 sm:flex-wrap sm:px-5"
        >
          {CATEGORY_LIST.map((category) => {
            const visible = !hidden.includes(category.id);
            return (
              <button
                key={category.id}
                type="button"
                aria-pressed={visible}
                onClick={() => toggleCategory(category.id)}
                className={cn(
                  "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border bg-card px-3 text-xs font-semibold transition hover:bg-muted",
                  !visible && "line-through opacity-50",
                )}
              >
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: category.color }}
                  aria-hidden="true"
                />
                {category.label}
              </button>
            );
          })}
          {member && (
            <span className="ml-auto hidden items-center gap-1.5 text-xs text-muted-foreground sm:inline-flex">
              <NotebookPen className="size-3.5" aria-hidden="true" />
              Team notes are shown on the calendar
            </span>
          )}
        </div>
      </div>

      <DayAgenda
        date={selectedDate}
        today={today}
        events={dayEvents}
        nextEvent={nextEvent}
        onSelectDate={(date) => updateUrl({ date })}
      />

      <EventQuickView event={openEvent} onOpenChange={(open) => !open && setOpenSlug(null)} />
    </div>
  );
}

function HeaderButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex size-9 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/25 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
    >
      {children}
    </button>
  );
}
