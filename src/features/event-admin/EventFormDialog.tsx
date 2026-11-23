"use client";

import { useId, useState } from "react";

import { MemberMultiSelect } from "@/components/team/MemberMultiSelect";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, Label, NativeSelect, Textarea, TextField } from "@/components/ui/form-controls";
import { CATEGORY_LIST } from "@/lib/categories";
import { formatEventDateRange, formatShortDate, getBerlinToday, isUpcoming } from "@/lib/dateUtils";
import { getParentCandidates } from "@/lib/eventGroups";
import { describeRhythm, occurrenceDates, seriesHorizon } from "@/lib/recurrence";
import { useSession } from "@/features/auth/session";
import { useEvents } from "@/services/eventClient";
import {
  EventFormSchema,
  RecurrenceSchema,
  type EsnEvent,
  type EventFormValues,
  type EventSeries,
  type EventStatus,
  type Recurrence,
} from "@/types/event";

type Errors = Partial<
  Record<keyof EventFormValues | "repeatUntil" | "repeatCount" | "form", string>
>;

type Rhythm = Pick<Recurrence, "frequency" | "interval" | "monthlyBy">;

/** The rhythms offered in the form (plus a series' own, if it's another one). */
const RHYTHMS: Record<string, Rhythm> = {
  weekly: { frequency: "weekly", interval: 1 },
  biweekly: { frequency: "weekly", interval: 2 },
  "monthly-weekday": { frequency: "monthly", interval: 1, monthlyBy: "weekday" },
  "monthly-day": { frequency: "monthly", interval: 1, monthlyBy: "day" },
};

function rhythmKey(rule: Recurrence): string {
  const match = Object.entries(RHYTHMS).find(
    ([, r]) =>
      r.frequency === rule.frequency &&
      r.interval === rule.interval &&
      (r.frequency === "weekly" || r.monthlyBy === (rule.monthlyBy ?? "weekday")),
  );
  return match ? match[0] : "current";
}

type EndMode = "never" | "until" | "count";

export type EventFormSubmit = (
  values: EventFormValues,
  hostIds: string[],
  /** Set when the event repeats. */
  recurrence?: Recurrence,
) => Promise<void>;

const STATUS_LABELS: Record<EventStatus, string> = {
  scheduled: "Confirmed",
  tentative: "To be confirmed",
  cancelled: "Cancelled",
};

/**
 * Create or edit an event, including its hosts. New events can repeat
 * (weekly, every two weeks or monthly). Validated with the shared Zod
 * schemas; saving is delegated to the caller.
 */
export function EventFormDialog({
  open,
  onOpenChange,
  event,
  series,
  hostIds,
  defaultDate,
  parent,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present when editing (a date of a repeating event: only that date). */
  event?: EsnEvent;
  /** Present when editing every date of a repeating event. */
  series?: EventSeries;
  hostIds?: string[];
  defaultDate?: string;
  /** When adding a sub-event: the main event it belongs to. */
  parent?: EsnEvent;
  onSubmit: EventFormSubmit;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-5 p-6 sm:p-7">
        {open && (
          <EventForm
            event={event}
            series={series}
            initialHostIds={hostIds ?? []}
            defaultDate={defaultDate}
            parent={parent}
            onCancel={() => onOpenChange(false)}
            onSubmit={onSubmit}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function EventForm({
  event: editedEvent,
  series,
  initialHostIds,
  defaultDate,
  parent,
  onCancel,
  onSubmit,
}: {
  event?: EsnEvent;
  series?: EventSeries;
  initialHostIds: string[];
  defaultDate?: string;
  parent?: EsnEvent;
  onCancel: () => void;
  onSubmit: EventFormSubmit;
}) {
  // Editing a whole series fills the form from the series' template.
  const event: EsnEvent | undefined =
    editedEvent ?? (series && { ...series, tags: [], seriesId: series.id });
  const isSeriesDate = Boolean(editedEvent?.seriesId);
  // New stand-alone events can repeat; a series keeps repeating.
  const canRepeat = Boolean(series) || (!event && !parent);
  const id = useId();
  const { members } = useSession();
  const { events } = useEvents();
  const today = getBerlinToday();
  // Past events are left out to keep the list short (unless already chosen).
  const parentOptions = getParentCandidates(events, event).filter(
    (p) => isUpcoming(p, today) || p.slug === event?.parentSlug || p.slug === parent?.slug,
  );
  const subEventCount = event ? events.filter((e) => e.parentSlug === event.slug).length : 0;
  // A new sub-event starts with its main event's details.
  const defaults = event ?? {
    startDate: defaultDate ?? parent?.startDate,
    category: parent?.category,
    location: parent?.location,
    parentSlug: parent?.slug,
  };
  const [hostIds, setHostIds] = useState(initialHostIds);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [startDate, setStartDate] = useState(defaults.startDate ?? "");
  const [repeat, setRepeat] = useState(series ? rhythmKey(series.recurrence) : "none");
  const [endMode, setEndMode] = useState<EndMode>(
    series?.recurrence.until ? "until" : series?.recurrence.count ? "count" : "never",
  );
  const rhythms: Record<string, Rhythm> = series
    ? { ...RHYTHMS, current: series.recurrence }
    : RHYTHMS;
  const repeats = canRepeat && repeat !== "none";
  const validStart = /^\d{4}-\d{2}-\d{2}$/.test(startDate) ? startDate : null;

  function buildRecurrence(data: FormData) {
    const rhythm = rhythms[repeat];
    const until = String(data.get("repeatUntil") ?? "").trim();
    const count = String(data.get("repeatCount") ?? "").trim();
    return {
      ...rhythm,
      until: endMode === "until" ? until || undefined : undefined,
      count: endMode === "count" ? (count === "" ? Number.NaN : Number(count)) : undefined,
    };
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const text = (name: string) => {
      const value = String(data.get(name) ?? "").trim();
      return value === "" ? undefined : value;
    };
    const result = EventFormSchema.safeParse({
      title: text("title") ?? "",
      summary: text("summary") ?? "",
      description: text("description"),
      category: text("category"),
      status: text("status"),
      startDate: text("startDate") ?? "",
      endDate: text("endDate"),
      startTime: text("startTime"),
      endTime: text("endTime"),
      location: text("location"),
      priceInfo: text("priceInfo"),
      registrationUrl: text("registrationUrl"),
      parentSlug: repeats || isSeriesDate ? undefined : text("parentSlug"),
    });
    const next: Errors = {};
    let firstInvalid: string | undefined;
    const fail = (key: keyof Errors, message: string) => {
      next[key] ??= message;
      firstInvalid ??= key;
    };
    if (!result.success) {
      for (const issue of result.error.issues) {
        fail((issue.path[0] as keyof EventFormValues) ?? "form", issue.message);
      }
    }
    let recurrence: Recurrence | undefined;
    if (repeats) {
      const rule = RecurrenceSchema.safeParse(buildRecurrence(data));
      if (!rule.success) {
        const field = endMode === "count" ? "repeatCount" : "repeatUntil";
        fail(field, rule.error.issues[0]?.message ?? "Check when it ends");
      } else if (endMode === "until" && !rule.data.until) {
        fail("repeatUntil", "Pick the last date");
      } else if (rule.data.until && validStart && rule.data.until < validStart) {
        fail("repeatUntil", "The last date is before the first one");
      } else {
        recurrence = rule.data;
      }
    }
    if (!result.success || (repeats && !recurrence)) {
      setErrors(next);
      // Move focus to the first invalid field.
      if (firstInvalid) {
        (e.currentTarget.elements.namedItem(firstInvalid) as HTMLElement | null)?.focus();
      }
      return;
    }
    setSaving(true);
    try {
      await onSubmit(result.data, hostIds, recurrence);
    } catch (error) {
      setErrors({ form: error instanceof Error ? error.message : "Couldn't save the event." });
    } finally {
      setSaving(false);
    }
  }

  const description = event && event.description !== event.summary ? event.description : "";

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <DialogHeader className="pr-8">
        <DialogTitle>
          {series
            ? "Edit repeating event"
            : isSeriesDate
              ? "Edit this date"
              : event
                ? "Edit event"
                : parent
                  ? "Add sub-event"
                  : "Add event"}
        </DialogTitle>
        <DialogDescription>
          {series
            ? "Changes apply to every date. Dates from today on that were changed on their own are reset to these details."
            : isSeriesDate
              ? "Only this date changes; the other dates of the repeating event stay as they are."
              : event
                ? "Changes are visible to everyone on the event page, feed and calendar."
                : parent
                  ? `Part of “${parent.title}”. It gets its own page and shows up in its programme.`
                  : "The event appears in the Upcoming feed and the calendar right away."}
        </DialogDescription>
      </DialogHeader>

      <Field id={`${id}-title`} label="Title" error={errors.title}>
        <TextField name="title" defaultValue={event?.title} maxLength={100} autoFocus />
      </Field>

      {!repeats && !isSeriesDate && (
        <Field
          id={`${id}-parent`}
          label="Part of"
          hint={
            subEventCount > 0
              ? `This event has ${subEventCount} sub-event${subEventCount === 1 ? "" : "s"}, so it can't be part of another event.`
              : "Optional. Pick the main event if this is one part of a bigger event (e.g. a weekend programme)."
          }
          error={errors.parentSlug}
        >
          <NativeSelect
            name="parentSlug"
            defaultValue={defaults.parentSlug ?? ""}
            disabled={subEventCount > 0}
          >
            <option value="">Not part of another event</option>
            {parentOptions.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.title} ({formatEventDateRange(p)})
              </option>
            ))}
          </NativeSelect>
        </Field>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${id}-category`} label="Category" error={errors.category}>
          <NativeSelect name="category" defaultValue={defaults.category ?? "social"}>
            {CATEGORY_LIST.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field id={`${id}-status`} label="Status" error={errors.status}>
          <NativeSelect name="status" defaultValue={event?.status ?? "scheduled"}>
            {(Object.keys(STATUS_LABELS) as EventStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Field
          id={`${id}-start-date`}
          label={repeats ? "First date" : "Date"}
          error={errors.startDate}
          className="sm:col-span-2"
        >
          <TextField
            name="startDate"
            type="date"
            defaultValue={defaults.startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </Field>
        <Field
          id={`${id}-end-date`}
          label="Ends on"
          hint="Multi-day only"
          error={errors.endDate}
          className="sm:col-span-2"
        >
          <TextField name="endDate" type="date" defaultValue={event?.endDate} />
        </Field>
        <Field id={`${id}-start-time`} label="Start" hint="Optional" error={errors.startTime}>
          <TextField name="startTime" type="time" defaultValue={event?.startTime} />
        </Field>
        <Field id={`${id}-end-time`} label="End" hint="Optional" error={errors.endTime}>
          <TextField name="endTime" type="time" defaultValue={event?.endTime} />
        </Field>
        <Field
          id={`${id}-location`}
          label="Location"
          hint="Optional"
          error={errors.location}
          className="sm:col-span-2"
        >
          <TextField name="location" defaultValue={defaults.location} maxLength={120} />
        </Field>
      </div>

      {canRepeat && (
        <RepeatFields
          id={id}
          startDate={validStart}
          rhythms={rhythms}
          repeat={repeat}
          onRepeatChange={setRepeat}
          allowNone={!series}
          endMode={endMode}
          onEndModeChange={setEndMode}
          initial={series?.recurrence}
          errors={errors}
        />
      )}

      <Field
        id={`${id}-summary`}
        label="Short summary"
        hint="One sentence shown on the event cards."
        error={errors.summary}
      >
        <TextField name="summary" defaultValue={event?.summary} maxLength={200} />
      </Field>

      <Field
        id={`${id}-description`}
        label="Description"
        hint="Optional. Shown on the event page; leave a blank line between paragraphs."
        error={errors.description}
      >
        <Textarea name="description" defaultValue={description} rows={4} maxLength={4000} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id={`${id}-price`}
          label="Price"
          hint="Optional, e.g. €15 with ESNcard"
          error={errors.priceInfo}
        >
          <TextField name="priceInfo" defaultValue={event?.priceInfo} maxLength={80} />
        </Field>
        <Field
          id={`${id}-registration`}
          label="Registration link"
          hint="Optional, e.g. pretix or a form"
          error={errors.registrationUrl}
        >
          <TextField
            name="registrationUrl"
            type="url"
            inputMode="url"
            placeholder="https://"
            defaultValue={event?.registrationUrl}
          />
        </Field>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label id={`${id}-hosts-label`}>
          Hosts{" "}
          <span className="font-normal text-muted-foreground">({hostIds.length} selected)</span>
        </Label>
        <MemberMultiSelect members={members} value={hostIds} onChange={setHostIds} label="Hosts" />
      </div>

      {errors.form && (
        <p
          role="alert"
          className="rounded-xl bg-destructive/10 p-3 text-sm font-semibold text-destructive"
        >
          {errors.form}
        </p>
      )}

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {series
            ? "Save all dates"
            : event
              ? "Save changes"
              : parent
                ? "Add sub-event"
                : repeats
                  ? "Add repeating event"
                  : "Add event"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** "Repeats" + "Ends", with a preview of the dates. */
function RepeatFields({
  id,
  startDate,
  rhythms,
  repeat,
  onRepeatChange,
  allowNone,
  endMode,
  onEndModeChange,
  initial,
  errors,
}: {
  id: string;
  startDate: string | null;
  rhythms: Record<string, Rhythm>;
  repeat: string;
  onRepeatChange: (key: string) => void;
  allowNone: boolean;
  endMode: EndMode;
  onEndModeChange: (mode: EndMode) => void;
  initial?: Recurrence;
  errors: Errors;
}) {
  const [until, setUntil] = useState(initial?.until ?? "");
  const [count, setCount] = useState(initial?.count ? String(initial.count) : "");
  const rhythm = rhythms[repeat];
  const label = (r: Rhythm) =>
    startDate
      ? describeRhythm(r, startDate)
      : r.frequency === "weekly"
        ? r.interval === 1
          ? "Every week"
          : `Every ${r.interval} weeks`
        : r.monthlyBy === "day"
          ? "Every month (same day)"
          : "Every month (same weekday)";

  let summary: string | null = null;
  if (rhythm && startDate) {
    const today = getBerlinToday();
    const horizon = seriesHorizon(today);
    const rule = RecurrenceSchema.safeParse({
      ...rhythm,
      until: endMode === "until" && until ? until : undefined,
      count: endMode === "count" && count ? Number(count) : undefined,
    });
    if (rule.success && !(rule.data.until && rule.data.until < startDate)) {
      const dates = occurrenceDates(rule.data, startDate, horizon);
      const shown = dates.slice(0, 3).map(formatShortDate).join(" · ");
      // Dates are generated up to a year ahead; later ones appear over time.
      const open =
        endMode === "never" ||
        (rule.data.until ?? "") > horizon ||
        dates.length < (rule.data.count ?? 0);
      summary =
        dates.length <= 3
          ? `${dates.length} dates: ${shown}.`
          : `${open ? "Dates" : `${dates.length} dates`}: ${shown} … ${
              open
                ? "Shown up to a year ahead; new dates keep appearing."
                : `until ${formatShortDate(dates[dates.length - 1])}.`
            }`;
    }
  }

  return (
    <fieldset className="flex flex-col gap-4 rounded-2xl border border-border p-4">
      <legend className="px-1 text-sm font-semibold">Repeats</legend>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${id}-repeat`} label="How often">
          <NativeSelect
            name="repeat"
            value={repeat}
            onChange={(e) => onRepeatChange(e.target.value)}
          >
            {allowNone && <option value="none">Doesn&apos;t repeat</option>}
            {Object.entries(rhythms).map(([key, r]) => (
              <option key={key} value={key}>
                {label(r)}
              </option>
            ))}
          </NativeSelect>
        </Field>
        {rhythm && (
          <Field id={`${id}-repeat-end`} label="Stops repeating">
            <NativeSelect
              name="repeatEnds"
              value={endMode}
              onChange={(e) => onEndModeChange(e.target.value as EndMode)}
            >
              <option value="never">No end date</option>
              <option value="until">On a date</option>
              <option value="count">After a number of dates</option>
            </NativeSelect>
          </Field>
        )}
        {rhythm && endMode === "until" && (
          <Field
            id={`${id}-repeat-until`}
            label="Last date"
            error={errors.repeatUntil}
            className="sm:col-start-2"
          >
            <TextField
              name="repeatUntil"
              type="date"
              min={startDate ?? undefined}
              value={until}
              onChange={(e) => setUntil(e.target.value)}
            />
          </Field>
        )}
        {rhythm && endMode === "count" && (
          <Field
            id={`${id}-repeat-count`}
            label="Number of dates"
            error={errors.repeatCount}
            className="sm:col-start-2"
          >
            <TextField
              name="repeatCount"
              type="number"
              inputMode="numeric"
              min={2}
              max={260}
              value={count}
              onChange={(e) => setCount(e.target.value)}
            />
          </Field>
        )}
      </div>
      {rhythm && (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {summary ??
            "Pick the first date to see when it takes place. Each date gets its own page, shifts and notes."}
        </p>
      )}
    </fieldset>
  );
}
