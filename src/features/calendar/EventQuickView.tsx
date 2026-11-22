"use client";

import { useId, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Clock,
  ExternalLink,
  Link2,
  MapPin,
  NotebookPen,
  Pencil,
  Ticket,
  UserRound,
} from "lucide-react";

import { CategoryIcon } from "@/components/events/CategoryIcon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/form-controls";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { getCategoryMeta } from "@/lib/categories";
import { formatEventDateLong, formatTimeRange } from "@/lib/dateUtils";
import { canManageEvents } from "@/features/auth/permissions";
import { useSession } from "@/features/auth/session";
import { SignInButton } from "@/features/auth/SignInDialog";
import { useEventInfo, useSaveEventInfo } from "@/services/teamClient";
import type { EsnEvent } from "@/types/event";
import type { Member } from "@/types/team";

/**
 * Pop-up for an event clicked in the calendar: the key facts, hosts, the
 * team's notes (readable by the team, editable by members), and a button to
 * the full event page.
 */
export function EventQuickView({
  event,
  onOpenChange,
}: {
  event: EsnEvent | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={event !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-lg gap-0 overflow-y-auto p-0">
        {event && <QuickView event={event} onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function QuickView({ event, onClose }: { event: EsnEvent; onClose: () => void }) {
  const meta = getCategoryMeta(event.category);
  const { member, members } = useSession();
  const { info } = useEventInfo(event.slug);
  const hosts = info.hostIds
    .map((id) => members.find((m) => m.id === id))
    .filter((m): m is Member => !!m);
  const time = formatTimeRange(event);

  return (
    <>
      <div
        className="relative overflow-hidden px-6 pt-6 pb-5 text-white"
        style={{ background: `linear-gradient(135deg, ${meta.textColor}, ${meta.color})` }}
      >
        <CategoryIcon
          category={event.category}
          className="pointer-events-none absolute -right-4 -bottom-6 size-32 opacity-15"
        />
        <DialogHeader className="relative gap-2 pr-8 text-left">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-bold backdrop-blur">
              <CategoryIcon category={event.category} className="size-3.5" />
              {meta.shortLabel}
            </span>
            {event.status === "tentative" && (
              <Badge variant="warning" className="border-white/40">
                To be confirmed
              </Badge>
            )}
            {event.status === "cancelled" && <Badge variant="secondary">Cancelled</Badge>}
          </div>
          <DialogTitle className="text-2xl leading-tight font-extrabold text-white">
            {event.title}
          </DialogTitle>
          <DialogDescription className="text-white/85">{event.summary}</DialogDescription>
        </DialogHeader>
      </div>

      <div className="flex flex-col gap-5 p-6">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <Fact icon={CalendarDays} label="Date">
            {formatEventDateLong(event)}
          </Fact>
          <Fact icon={Clock} label="Time">
            {time ?? "To be announced"}
          </Fact>
          {event.location && (
            <Fact icon={MapPin} label="Where" className="sm:col-span-2">
              {event.location}
            </Fact>
          )}
          {event.priceInfo && (
            <Fact icon={Ticket} label="Price" className="sm:col-span-2">
              {event.priceInfo}
            </Fact>
          )}
          {hosts.length > 0 && (
            <Fact
              icon={UserRound}
              label={hosts.length === 1 ? "Host" : "Hosts"}
              className="sm:col-span-2"
            >
              <ul aria-label="Hosts" className="mt-1 flex flex-wrap gap-2">
                {hosts.map((host) => (
                  <li
                    key={host.id}
                    className="inline-flex items-center gap-1.5 rounded-full bg-muted py-0.5 pr-2.5 pl-0.5"
                  >
                    <MemberAvatar member={host} size="sm" />
                    <span className="text-sm font-semibold">{host.name}</span>
                  </li>
                ))}
              </ul>
            </Fact>
          )}
        </dl>

        <TeamNotes event={event} viewer={member} notes={info.notes} links={info.links} />
      </div>

      <DialogFooter className="border-t bg-muted/40 px-6 py-4">
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
        <Button asChild variant="brand">
          <Link href={`/events/${event.slug}`}>
            Open event page
            <ArrowRight />
          </Link>
        </Button>
      </DialogFooter>
    </>
  );
}

function Fact({
  icon: Icon,
  label,
  children,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="flex items-center gap-1.5 text-xs font-bold tracking-wide text-muted-foreground uppercase">
        <Icon className="size-3.5" aria-hidden="true" />
        {label}
      </dt>
      <dd className="mt-0.5 font-semibold">{children}</dd>
    </div>
  );
}

/** Team-only notes, like the "Notes" row of the planning sheet. */
function TeamNotes({
  event,
  viewer,
  notes,
  links,
}: {
  event: EsnEvent;
  viewer: Member | null;
  notes: string;
  links: { id: string; label: string; url: string }[];
}) {
  const id = useId();
  const save = useSaveEventInfo();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(notes);
  const [error, setError] = useState<string | null>(null);
  const canEdit = canManageEvents(viewer);

  if (!viewer) {
    return (
      <section className="flex flex-col items-start gap-3 rounded-2xl bg-muted/60 p-4 text-sm">
        <p className="text-muted-foreground">
          The team&apos;s notes for this event are visible after signing in.
        </p>
        <SignInButton size="sm" label="Team sign in" />
      </section>
    );
  }

  async function submit() {
    setError(null);
    try {
      await save.mutateAsync({
        eventSlug: event.slug,
        patch: { notes: draft.trim() },
        updatedBy: viewer?.id,
      });
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the notes.");
    }
  }

  return (
    <section
      aria-labelledby={`${id}-notes`}
      className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-500/30 dark:bg-amber-500/10"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 id={`${id}-notes`} className="flex items-center gap-2 text-sm font-bold">
          <NotebookPen className="size-4 text-amber-700 dark:text-amber-300" aria-hidden="true" />
          Team notes
        </h3>
        {canEdit && !editing && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setDraft(notes);
              setEditing(true);
            }}
          >
            <Pencil />
            {notes.trim() ? "Edit notes" : "Add notes"}
          </Button>
        )}
      </div>

      {editing ? (
        <div className="mt-3 flex flex-col gap-2">
          <label htmlFor={`${id}-text`} className="sr-only">
            Notes
          </label>
          <Textarea
            id={`${id}-text`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={5}
            maxLength={4000}
            autoFocus
            placeholder="Meeting point, budget, what to bring, who to call…"
          />
          {error && (
            <p role="alert" className="text-sm font-semibold text-destructive">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={submit} disabled={save.isPending}>
              Save notes
            </Button>
          </div>
        </div>
      ) : notes.trim() ? (
        <p className="mt-2 text-sm leading-relaxed whitespace-pre-line">{notes}</p>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">No notes yet.</p>
      )}

      {links.length > 0 && !editing && (
        <ul aria-label="Important links" className="mt-3 flex flex-wrap gap-2">
          {links.map((link) => (
            <li key={link.id}>
              <a
                href={link.url}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs font-semibold text-primary hover:bg-accent"
              >
                <Link2 className="size-3.5" aria-hidden="true" />
                {link.label}
                <ExternalLink className="size-3 opacity-60" aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
