"use client";

import { useState } from "react";
import { Pencil, UserRoundCog } from "lucide-react";

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
import { MemberAvatar } from "@/components/ui/member-avatar";
import { canManageEvents } from "@/features/auth/permissions";
import { useSession } from "@/features/auth/session";
import { useEventInfo, useUpdateEventInfo } from "@/services/teamClient";
import type { Member } from "@/types/team";

/** "Hosted by" block for the event facts box. Public; editable by managers. */
export function EventHosts({ eventSlug }: { eventSlug: string }) {
  const { member, members } = useSession();
  const { info, isSuccess } = useEventInfo(eventSlug);
  const update = useUpdateEventInfo(eventSlug);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>([]);
  const hosts = info.hostIds
    .map((id) => members.find((m) => m.id === id))
    .filter((m): m is Member => !!m);
  const manager = canManageEvents(member);

  if (!isSuccess || (!hosts.length && !manager)) return null;

  return (
    <div className="flex items-start gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
        <UserRoundCog className="size-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {hosts.length === 1 ? "Host" : "Hosts"}
          </p>
          {manager && (
            <Button
              variant="ghost"
              size="sm"
              className="-my-1 h-7 px-2"
              onClick={() => {
                setDraft(info.hostIds);
                setOpen(true);
              }}
              aria-label="Edit hosts"
            >
              <Pencil />
              Edit
            </Button>
          )}
        </div>
        {hosts.length ? (
          <ul className="mt-1.5 flex flex-col gap-1.5" aria-label="Hosts">
            {hosts.map((host) => (
              <li key={host.id} className="flex items-center gap-2">
                <MemberAvatar member={host} size="sm" />
                <span className="truncate font-semibold">{host.name}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground italic">No hosts yet</p>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md gap-4 p-6 sm:p-7">
          <DialogHeader className="pr-8">
            <DialogTitle>Event hosts</DialogTitle>
            <DialogDescription>
              Hosts are shown on the event page and in the event feed.
            </DialogDescription>
          </DialogHeader>
          <MemberMultiSelect members={members} value={draft} onChange={setDraft} label="Hosts" />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={update.isPending}
              onClick={async () => {
                await update.mutateAsync({ patch: { hostIds: draft }, updatedBy: member?.id });
                setOpen(false);
              }}
            >
              Save hosts
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Comma-separated host first names for cards, e.g. "Aisha & Jonas". */
export function formatHostNames(hostIds: readonly string[], members: readonly Member[]) {
  const names = hostIds
    .map((id) => members.find((m) => m.id === id)?.name.split(" ")[0])
    .filter((n): n is string => !!n);
  if (names.length <= 1) return names[0] ?? null;
  return `${names.slice(0, -1).join(", ")} & ${names.at(-1)}`;
}
