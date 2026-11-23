"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { canManageEvents } from "@/features/auth/permissions";
import { useSession } from "@/features/auth/session";
import { getBerlinToday } from "@/lib/dateUtils";
import {
  describeRecurrence,
  isSeriesDate,
  occurrenceDates,
  occurrenceSlug,
  parseOccurrenceSlug,
  seriesHorizon,
} from "@/lib/recurrence";
import { useEventAdminMutations, useEvents, useSeries } from "@/services/eventClient";
import { useEventInfo, useSaveEventInfo } from "@/services/teamClient";
import type { EsnEvent, EventSeries } from "@/types/event";

import { EventFormDialog } from "./EventFormDialog";

const destructive = "bg-destructive text-white hover:bg-destructive/90";
const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

/**
 * Edit / remove controls on the event page (organisers and board only).
 * Dates of repeating events can be changed or removed on their own or
 * together with every other date.
 */
export function EventAdminBar({ event }: { event: EsnEvent }) {
  const { member } = useSession();
  const { info } = useEventInfo(event.slug);
  const { events } = useEvents();
  const { series: allSeries } = useSeries();
  const series = event.seriesId ? allSeries.find((s) => s.id === event.seriesId) : undefined;
  const subEventCount = events.filter((e) => e.parentSlug === event.slug).length;
  const { updateEvent, deleteEvent, updateSeries, deleteSeries } = useEventAdminMutations();
  const saveInfo = useSaveEventInfo();
  const router = useRouter();
  const [editing, setEditing] = useState<"event" | "series" | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canManageEvents(member)) return null;
  const repeating = Boolean(event.seriesId);

  async function run(action: () => Promise<void>) {
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't remove the event.");
    }
  }

  const removeEvent = () =>
    run(async () => {
      await deleteEvent.mutateAsync(event.slug);
      setConfirming(false);
      router.push(nextDateHref(series, event.slug) ?? "/");
    });

  const removeSeries = () =>
    run(async () => {
      await deleteSeries.mutateAsync(series!.id);
      setConfirming(false);
      router.push("/");
    });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => (repeating ? setChoosing(true) : setEditing("event"))}
      >
        <Pencil />
        Edit event
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => {
          setError(null);
          setConfirming(true);
        }}
      >
        <Trash2 />
        Remove event
      </Button>

      {/* Repeating events: this date or every date? */}
      <Dialog open={choosing} onOpenChange={setChoosing}>
        <DialogContent className="max-w-sm gap-4 p-6">
          <DialogHeader>
            <DialogTitle>Edit a repeating event</DialogTitle>
            <DialogDescription>
              {series
                ? `“${event.title}” repeats: ${lowerFirst(describeRecurrence(series.recurrence, series.startDate))}.`
                : `“${event.title}” is one date of a repeating event.`}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setChoosing(false);
                setEditing("event");
              }}
            >
              Only this date
            </Button>
            <Button
              disabled={!series}
              onClick={() => {
                setChoosing(false);
                setEditing("series");
              }}
            >
              All dates
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <EventFormDialog
        open={editing === "event"}
        onOpenChange={(open) => setEditing(open ? "event" : null)}
        event={event}
        hostIds={info.hostIds}
        onSubmit={async (values, hostIds) => {
          await updateEvent.mutateAsync({ current: event, values });
          await saveInfo.mutateAsync({
            eventSlug: event.slug,
            patch: { hostIds },
            updatedBy: member?.id,
          });
          setEditing(null);
        }}
      />

      {series && (
        <EventFormDialog
          open={editing === "series"}
          onOpenChange={(open) => setEditing(open ? "series" : null)}
          series={series}
          hostIds={series.hostIds}
          onSubmit={async (values, hostIds, recurrence) => {
            if (!recurrence) return;
            const updated = await updateSeries.mutateAsync({
              id: series.id,
              input: { values, recurrence, hostIds },
            });
            setEditing(null);
            // This date may no longer be part of the series (e.g. another weekday).
            const date = parseOccurrenceSlug(event.slug)?.date;
            const horizon = seriesHorizon(getBerlinToday());
            if (!date || !isSeriesDate(updated, date, horizon)) {
              router.push(nextDateHref(updated) ?? "/");
            }
          }}
        />
      )}

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent className="max-w-sm gap-4 p-6" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Remove “{event.title}”?</DialogTitle>
            <DialogDescription>
              {repeating
                ? "Remove only this date, or every date of the repeating event? Shifts, notes and reviews of removed dates are no longer shown."
                : "The event disappears from the feed, the calendar and its page. Shifts, notes and reviews for it are no longer shown."}
              {subEventCount > 0 &&
                ` Its ${subEventCount} sub-event${subEventCount === 1 ? " stays" : "s stay"} as separate events.`}
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p role="alert" className="text-sm font-semibold text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            {repeating ? (
              <>
                <Button
                  variant="outline"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={removeEvent}
                  disabled={deleteEvent.isPending}
                >
                  Remove this date
                </Button>
                <Button
                  className={destructive}
                  onClick={removeSeries}
                  disabled={!series || deleteSeries.isPending}
                >
                  Remove all dates
                </Button>
              </>
            ) : (
              <Button
                className={destructive}
                onClick={removeEvent}
                disabled={deleteEvent.isPending}
              >
                Remove event
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * The page of the series' next date: after `removedSlug` (when a date was
 * just removed), otherwise the next one from today.
 */
function nextDateHref(series: EventSeries | undefined, removedSlug?: string): string | null {
  if (!series) return null;
  const today = getBerlinToday();
  const removed = removedSlug ? parseOccurrenceSlug(removedSlug)?.date : undefined;
  const from = removed && removed > today ? removed : today;
  const excluded = new Set(series.excludedDates);
  const next = occurrenceDates(series.recurrence, series.startDate, seriesHorizon(today)).find(
    (date) => date >= from && date !== removed && !excluded.has(date),
  );
  return next ? `/events/${occurrenceSlug(series.slug, next)}` : null;
}
