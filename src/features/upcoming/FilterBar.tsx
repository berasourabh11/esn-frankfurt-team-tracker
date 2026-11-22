"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarSearch, Search, X } from "lucide-react";

import { CategoryIcon } from "@/components/events/CategoryIcon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CATEGORY_LIST } from "@/lib/categories";
import { cn } from "@/lib/utils";
import type { EventCategory } from "@/types/event";

import {
  DATE_PRESET_LABELS,
  DATE_PRESETS,
  hasActiveFilters,
  type DatePreset,
  type EventFilters,
} from "./filters";

const SEARCH_DEBOUNCE_MS = 250;

export function FilterBar({
  filters,
  onChange,
  onClear,
  today,
}: {
  filters: EventFilters;
  onChange: (update: Partial<EventFilters>) => void;
  onClear: () => void;
  today: string;
}) {
  const [query, setQuery] = useState(filters.query);
  const lastPushed = useRef(filters.query);

  // Keep the input in sync when the URL changes from elsewhere (header search, back button).
  useEffect(() => {
    if (filters.query !== lastPushed.current) {
      lastPushed.current = filters.query;
      setQuery(filters.query);
    }
  }, [filters.query]);

  useEffect(() => {
    if (query === lastPushed.current) return;
    const timeout = window.setTimeout(() => {
      lastPushed.current = query;
      onChange({ query });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timeout);
  }, [query, onChange]);

  function toggleCategory(category: EventCategory) {
    const categories = filters.categories.includes(category)
      ? filters.categories.filter((c) => c !== category)
      : [...filters.categories, category];
    onChange({ categories });
  }

  function selectPreset(date: DatePreset) {
    onChange({ date, on: null });
  }

  const active = hasActiveFilters({ ...filters, query });

  return (
    <div
      role="search"
      aria-label="Filter events"
      className="flex flex-col gap-3 rounded-2xl border bg-card/90 p-3 shadow-[0_8px_30px_-12px_rgb(46_49_146/0.18)] backdrop-blur supports-[backdrop-filter]:bg-card/80 sm:p-4"
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search events, places…"
            aria-label="Search events"
            className="h-11 pl-10"
            maxLength={100}
          />
        </div>
        <div className="flex gap-2">
          <label className="relative flex h-11 flex-1 items-center sm:flex-none">
            <span className="sr-only">Pick a date</span>
            <CalendarSearch
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 size-4 text-muted-foreground"
            />
            <input
              type="date"
              min={today}
              value={filters.on ?? ""}
              onChange={(e) =>
                onChange(e.target.value ? { on: e.target.value, date: "all" } : { on: null })
              }
              className={cn(
                "h-11 w-full rounded-full border border-input bg-card pr-3 pl-10 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 sm:w-44",
                filters.on && "border-primary/40 bg-accent font-semibold text-accent-foreground",
              )}
            />
          </label>
          {active && (
            <Button
              variant="ghost"
              className="h-11 shrink-0"
              onClick={() => {
                lastPushed.current = "";
                setQuery("");
                onClear();
              }}
            >
              <X />
              Clear
            </Button>
          )}
        </div>
      </div>

      <div
        role="group"
        aria-label="Date"
        className="-mx-3 flex [scrollbar-width:none] gap-1.5 overflow-x-auto px-3 pb-0.5 sm:-mx-4 sm:px-4"
      >
        {DATE_PRESETS.map((preset) => {
          const selected = !filters.on && filters.date === preset;
          return (
            <button
              key={preset}
              type="button"
              aria-pressed={selected}
              onClick={() => selectPreset(preset)}
              className={cn(
                "h-8 shrink-0 rounded-full px-3.5 text-sm font-semibold transition",
                selected
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/60",
              )}
            >
              {DATE_PRESET_LABELS[preset]}
            </button>
          );
        })}
      </div>

      <div
        role="group"
        aria-label="Categories"
        className="-mx-3 flex [scrollbar-width:none] gap-1.5 overflow-x-auto px-3 pb-0.5 sm:-mx-4 sm:flex-wrap sm:px-4"
      >
        {CATEGORY_LIST.map((category) => {
          const selected = filters.categories.includes(category.id);
          return (
            <button
              key={category.id}
              type="button"
              aria-pressed={selected}
              onClick={() => toggleCategory(category.id)}
              className={cn(
                "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold transition",
                !selected && "border-border bg-card text-foreground/80 hover:bg-muted",
              )}
              style={
                selected
                  ? {
                      // The darker tone keeps white text above WCAG AA contrast.
                      backgroundColor: category.textColor,
                      borderColor: category.textColor,
                      color: "white",
                    }
                  : undefined
              }
            >
              <CategoryIcon
                category={category.id}
                className="size-3.5"
                style={selected ? undefined : { color: category.color }}
              />
              {category.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
