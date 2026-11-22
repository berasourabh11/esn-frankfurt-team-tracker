"use client";

import { useState } from "react";
import { ClipboardList, Lock, MessageSquareText, X } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { useClientToday } from "@/hooks/useClientToday";
import { getEventEndDate } from "@/lib/dateUtils";
import { cn } from "@/lib/utils";
import { useSession } from "@/features/auth/session";
import { PendingApproval } from "@/features/auth/PendingApproval";
import { SignInButton } from "@/features/auth/SignInDialog";
import { useReviewNotes } from "@/services/teamClient";
import { MEMBER_ROLE_LABELS } from "@/types/team";

import { EventReview } from "./EventReview";
import { EventNotesCard } from "./EventNotesCard";
import { ShiftsAndTasks } from "./ShiftsAndTasks";

type Tab = "tasks" | "review";

/**
 * Internal team area on the event page: shifts & tasks before/during the
 * event, and the post-event review. Only shown to signed-in members.
 */
export function EventTeamPanel({
  event,
}: {
  event: { slug: string; title: string; startDate: string; endDate?: string };
}) {
  const { member, members, ready, pending } = useSession();
  const today = useClientToday();
  const isPast = today !== null && getEventEndDate(event) < today;
  const [chosenTab, setChosenTab] = useState<Tab | null>(null);
  const tab: Tab = chosenTab ?? (isPast ? "review" : "tasks");
  const [error, setError] = useState<string | null>(null);
  const reviewCount = useReviewNotes(event.slug, !!member).data?.length ?? 0;

  return (
    <section
      id="team"
      aria-labelledby="team-heading"
      className="scroll-mt-24 rounded-3xl border bg-card p-5 shadow-sm sm:p-7"
    >
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-bold tracking-wide text-brand-magenta uppercase">
            <Lock className="size-3.5" aria-hidden="true" />
            ESN team only
          </p>
          <h2 id="team-heading" className="text-xl font-extrabold tracking-tight sm:text-2xl">
            Team area
          </h2>
        </div>
        {member && (
          <p className="text-sm text-muted-foreground">
            Signed in as <strong className="text-foreground">{member.name}</strong> ·{" "}
            {MEMBER_ROLE_LABELS[member.role]}
          </p>
        )}
      </header>

      {!ready || today === null ? (
        <Skeleton className="h-40 rounded-2xl" />
      ) : !member && pending ? (
        <PendingApproval account={pending} />
      ) : !member ? (
        <div className="flex flex-col items-start gap-3 rounded-2xl bg-muted/60 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Volunteering at this event? Sign in to see shifts and tasks, sign up for a spot, and add
            notes for the event review.
          </p>
          <SignInButton variant="default" label="Sign in" className="shrink-0" />
        </div>
      ) : (
        <>
          <div className="mb-5">
            <EventNotesCard eventSlug={event.slug} viewer={member} members={members} />
          </div>
          <div
            role="tablist"
            aria-label="Team area"
            className="mb-5 flex gap-1 rounded-full bg-secondary p-1 sm:w-fit"
          >
            {(
              [
                ["tasks", "Shifts & tasks", ClipboardList],
                [
                  "review",
                  `Event review${reviewCount ? ` (${reviewCount})` : ""}`,
                  MessageSquareText,
                ],
              ] as const
            ).map(([value, label, Icon]) => (
              <button
                key={value}
                type="button"
                role="tab"
                id={`team-tab-${value}`}
                aria-selected={tab === value}
                aria-controls={`team-panel-${value}`}
                onClick={() => setChosenTab(value)}
                className={cn(
                  "flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-semibold transition sm:flex-none",
                  tab === value
                    ? "bg-card text-primary shadow-sm"
                    : "text-secondary-foreground/70 hover:text-secondary-foreground",
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>

          {error && (
            <div
              role="alert"
              className="mb-4 flex items-start justify-between gap-3 rounded-xl bg-destructive/10 p-3 text-sm font-semibold text-destructive"
            >
              {error}
              <button type="button" onClick={() => setError(null)} aria-label="Dismiss">
                <X className="size-4" />
              </button>
            </div>
          )}

          <div role="tabpanel" id={`team-panel-${tab}`} aria-labelledby={`team-tab-${tab}`}>
            {tab === "tasks" ? (
              <ShiftsAndTasks event={event} viewer={member} members={members} onError={setError} />
            ) : (
              <EventReview
                event={event}
                viewer={member}
                members={members}
                today={today}
                onError={setError}
              />
            )}
          </div>
        </>
      )}
    </section>
  );
}
