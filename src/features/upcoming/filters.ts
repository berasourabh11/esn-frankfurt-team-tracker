import {
  addDaysIso,
  getRestOfMonthRange,
  getWeekRange,
  getWeekendRange,
  overlapsRange,
  type DateRange,
  type IsoDate,
} from "@/lib/dateUtils";
import { EVENT_CATEGORIES, type EsnEvent, type EventCategory } from "@/types/event";

export const DATE_PRESETS = [
  "all",
  "today",
  "tomorrow",
  "weekend",
  "this-week",
  "next-week",
  "this-month",
] as const;
export type DatePreset = (typeof DATE_PRESETS)[number];

export const DATE_PRESET_LABELS: Record<DatePreset, string> = {
  all: "Any date",
  today: "Today",
  tomorrow: "Tomorrow",
  weekend: "This weekend",
  "this-week": "This week",
  "next-week": "Next week",
  "this-month": "This month",
};

export interface EventFilters {
  query: string;
  categories: EventCategory[];
  date: DatePreset;
  /** A specific day chosen in the date picker; overrides `date`. */
  on: IsoDate | null;
}

export const EMPTY_FILTERS: EventFilters = { query: "", categories: [], date: "all", on: null };

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Reads filters from URL search params, ignoring anything invalid. */
export function parseFilters(params: URLSearchParams): EventFilters {
  const query = (params.get("q") ?? "").slice(0, 100);
  const categories = (params.get("category") ?? "")
    .split(",")
    .filter((c): c is EventCategory => (EVENT_CATEGORIES as readonly string[]).includes(c));
  const rawDate = params.get("date");
  const date = (DATE_PRESETS as readonly string[]).includes(rawDate ?? "")
    ? (rawDate as DatePreset)
    : "all";
  const rawOn = params.get("on");
  const on = rawOn && ISO_DATE_RE.test(rawOn) ? rawOn : null;
  return { query, categories: [...new Set(categories)], date, on };
}

/** Writes filters into URL search params, omitting defaults to keep URLs short. */
export function serializeFilters(filters: EventFilters): URLSearchParams {
  const params = new URLSearchParams();
  const q = filters.query.trim();
  if (q) params.set("q", q);
  if (filters.categories.length) params.set("category", filters.categories.join(","));
  if (filters.on) params.set("on", filters.on);
  else if (filters.date !== "all") params.set("date", filters.date);
  return params;
}

export function hasActiveFilters(filters: EventFilters): boolean {
  return (
    filters.query.trim() !== "" ||
    filters.categories.length > 0 ||
    filters.date !== "all" ||
    filters.on !== null
  );
}

export function getPresetRange(preset: DatePreset, today: IsoDate): DateRange | null {
  switch (preset) {
    case "all":
      return null;
    case "today":
      return { from: today, to: today };
    case "tomorrow": {
      const tomorrow = addDaysIso(today, 1);
      return { from: tomorrow, to: tomorrow };
    }
    case "weekend":
      return getWeekendRange(today);
    case "this-week":
      return { from: today, to: getWeekRange(today).to };
    case "next-week":
      return getWeekRange(today, 1);
    case "this-month":
      return getRestOfMonthRange(today);
  }
}

function normalise(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function matchesQuery(event: EsnEvent, query: string): boolean {
  const terms = normalise(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const haystack = normalise(
    [event.title, event.location ?? "", event.summary, ...event.tags].join(" "),
  );
  return terms.every((term) => haystack.includes(term));
}

export function applyFilters(
  events: readonly EsnEvent[],
  filters: EventFilters,
  today: IsoDate,
): EsnEvent[] {
  const range = filters.on
    ? { from: filters.on, to: filters.on }
    : getPresetRange(filters.date, today);

  return events.filter((event) => {
    if (filters.categories.length && !filters.categories.includes(event.category)) return false;
    if (range && !overlapsRange(event, range)) return false;
    return matchesQuery(event, filters.query);
  });
}
