"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { VariantProps } from "class-variance-authority";
import { CalendarPlus } from "lucide-react";

import { Button, type buttonVariants } from "@/components/ui/button";
import { canManageEvents } from "@/features/auth/permissions";
import { useSession } from "@/features/auth/session";
import { useEventAdminMutations, useEvents } from "@/services/eventClient";
import { useSaveEventInfo } from "@/services/teamClient";

import { EventFormDialog } from "./EventFormDialog";

/** "Add event" for organisers and board members; hidden for everyone else. */
export function AddEventButton({
  defaultDate,
  label = "Add event",
  variant = "default",
  size,
  className,
}: {
  defaultDate?: string;
  label?: string;
  className?: string;
} & VariantProps<typeof buttonVariants>) {
  const { member } = useSession();
  const { events } = useEvents();
  const { createEvent } = useEventAdminMutations();
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
        hostIds={member ? [member.id] : []}
        onSubmit={async (values, hostIds) => {
          const created = await createEvent.mutateAsync({
            values,
            existingSlugs: events.map((e) => e.slug),
          });
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
