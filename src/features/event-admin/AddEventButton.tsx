"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { VariantProps } from "class-variance-authority";
import { CalendarPlus } from "lucide-react";

import { Button, type buttonVariants } from "@/components/ui/button";
import { canManageEvents } from "@/features/auth/permissions";
import { useSession } from "@/features/auth/session";
import { getEventAdminService, useEventAdminMutations, useEvents } from "@/services/eventClient";
import { useSaveEventInfo } from "@/services/teamClient";
import type { EsnEvent } from "@/types/event";

import { EventFormDialog } from "./EventFormDialog";

/**
 * "Add event" for members who manage events; hidden for everyone else.
 * With `parent`, it adds a sub-event of that main event.
 */
export function AddEventButton({
  defaultDate,
  parent,
  label = parent ? "Add sub-event" : "Add event",
  variant = "default",
  size,
  className,
}: {
  defaultDate?: string;
  parent?: EsnEvent;
  label?: string;
  className?: string;
} & VariantProps<typeof buttonVariants>) {
  const { member } = useSession();
  const { events } = useEvents();
  const { createEvent, createSeries } = useEventAdminMutations();
  const saveInfo = useSaveEventInfo();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  if (!canManageEvents(member)) return null;

  return (
    <>
      <Button variant={variant} size={size} className={className} onClick={() => setOpen(true)}>
        <CalendarPlus />
        {label}
      </Button>
      <EventFormDialog
        open={open}
        onOpenChange={setOpen}
        defaultDate={defaultDate}
        parent={parent}
        hostIds={member ? [member.id] : []}
        onSubmit={async (values, hostIds, recurrence) => {
          const existingSlugs = events.map((e) => e.slug);
          if (recurrence) {
            // Repeating: one series; the API keeps the hosts for every date.
            const first = await createSeries.mutateAsync({
              input: { values, recurrence, hostIds },
              existingSlugs,
            });
            if (hostIds.length && getEventAdminService().overlay) {
              await saveInfo.mutateAsync({
                eventSlug: first.slug,
                patch: { hostIds },
                updatedBy: member?.id,
              });
            }
            setOpen(false);
            router.push(`/events/${first.slug}`);
            return;
          }
          const created = await createEvent.mutateAsync({ values, existingSlugs });
          if (hostIds.length) {
            await saveInfo.mutateAsync({
              eventSlug: created.slug,
              patch: { hostIds },
              updatedBy: member?.id,
            });
          }
          setOpen(false);
          router.push(`/events/${created.slug}`);
        }}
      />
    </>
  );
}
