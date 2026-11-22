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
import { useEventAdminMutations, useEvents } from "@/services/eventClient";
import { useEventInfo, useSaveEventInfo } from "@/services/teamClient";
import type { EsnEvent } from "@/types/event";

import { EventFormDialog } from "./EventFormDialog";

/** Edit / remove controls on the event page (organisers and board only). */
export function EventAdminBar({ event }: { event: EsnEvent }) {
  const { member } = useSession();
  const { info } = useEventInfo(event.slug);
  const { events } = useEvents();
  const subEventCount = events.filter((e) => e.parentSlug === event.slug).length;
  const { updateEvent, deleteEvent } = useEventAdminMutations();
  const saveInfo = useSaveEventInfo();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canManageEvents(member)) return null;

  async function remove() {
    try {
      await deleteEvent.mutateAsync(event.slug);
      setConfirming(false);
      router.push("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't remove the event.");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
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

      <EventFormDialog
        open={editing}
        onOpenChange={setEditing}
        event={event}
        hostIds={info.hostIds}
        onSubmit={async (values, hostIds) => {
          await updateEvent.mutateAsync({ current: event, values });
          await saveInfo.mutateAsync({
            eventSlug: event.slug,
            patch: { hostIds },
            updatedBy: member?.id,
          });
          setEditing(false);
        }}
      />

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent className="max-w-sm gap-4 p-6" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Remove “{event.title}”?</DialogTitle>
            <DialogDescription>
              The event disappears from the feed, the calendar and its page. Shifts, notes and
              reviews for it are no longer shown.
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
            <Button
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={remove}
              disabled={deleteEvent.isPending}
            >
              Remove event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
