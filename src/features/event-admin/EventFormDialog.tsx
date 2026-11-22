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
import { formatEventDateRange, getBerlinToday, isUpcoming } from "@/lib/dateUtils";
import { getParentCandidates } from "@/lib/eventGroups";
import { useSession } from "@/features/auth/session";
import { useEvents } from "@/services/eventClient";
import {
  EventFormSchema,
  type EsnEvent,
  type EventFormValues,
  type EventStatus,
} from "@/types/event";

type Errors = Partial<Record<keyof EventFormValues | "form", string>>;

const STATUS_LABELS: Record<EventStatus, string> = {
  scheduled: "Confirmed",
  tentative: "To be confirmed",
  cancelled: "Cancelled",
};

/**
 * Create or edit an event, including its hosts. Validated with the shared
 * Zod schema; saving is delegated to the caller.
 */
export function EventFormDialog({
  open,
  onOpenChange,
  event,
  hostIds,
  defaultDate,
  parent,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present when editing. */
  event?: EsnEvent;
  hostIds?: string[];
  defaultDate?: string;
  /** When adding a sub-event: the main event it belongs to. */
  parent?: EsnEvent;
  onSubmit: (values: EventFormValues, hostIds: string[]) => Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-5 p-6 sm:p-7">
        {open && (
          <EventForm
            event={event}
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
  event,
  initialHostIds,
  defaultDate,
  parent,
  onCancel,
  onSubmit,
}: {
  event?: EsnEvent;
  initialHostIds: string[];
  defaultDate?: string;
  parent?: EsnEvent;
  onCancel: () => void;
  onSubmit: (values: EventFormValues, hostIds: string[]) => Promise<void>;
}) {
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
      parentSlug: text("parentSlug"),
    });
    if (!result.success) {
      const next: Errors = {};
      for (const issue of result.error.issues) {
        const key = (issue.path[0] as keyof EventFormValues) ?? "form";
        next[key] ??= issue.message;
      }
      setErrors(next);
      // Move focus to the first invalid field.
      const first = result.error.issues[0]?.path[0];
      if (typeof first === "string") {
        (e.currentTarget.elements.namedItem(first) as HTMLElement | null)?.focus();
      }
      return;
    }
    setSaving(true);
    try {
      await onSubmit(result.data, hostIds);
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
        <DialogTitle>{event ? "Edit event" : parent ? "Add sub-event" : "Add event"}</DialogTitle>
        <DialogDescription>
          {event
            ? "Changes are visible to everyone on the event page, feed and calendar."
            : parent
              ? `Part of “${parent.title}”. It gets its own page and shows up in its programme.`
              : "The event appears in the Upcoming feed and the calendar right away."}
        </DialogDescription>
      </DialogHeader>

      <Field id={`${id}-title`} label="Title" error={errors.title}>
        <TextField name="title" defaultValue={event?.title} maxLength={100} autoFocus />
      </Field>

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
          label="Date"
          error={errors.startDate}
          className="sm:col-span-2"
        >
          <TextField name="startDate" type="date" defaultValue={defaults.startDate} />
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
          {event ? "Save changes" : parent ? "Add sub-event" : "Add event"}
        </Button>
      </DialogFooter>
    </form>
  );
}
