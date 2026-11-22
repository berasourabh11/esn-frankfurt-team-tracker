"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarClock, ClipboardList, Lock, MapPin, Search, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/form-controls";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useClientToday } from "@/hooks/useClientToday";
import { formatShortDate, formatTimeRange } from "@/lib/dateUtils";
import { cn } from "@/lib/utils";
import { canManageMembers } from "@/features/auth/permissions";
import { useSession } from "@/features/auth/session";
import { PendingApproval } from "@/features/auth/PendingApproval";
import { SignInButton } from "@/features/auth/SignInDialog";
import { useEvents } from "@/services/eventClient";
import { useMemberTasks } from "@/services/teamClient";
import { MEMBER_ROLE_LABELS, MEMBER_ROLES, type Member, type MemberRole } from "@/types/team";

export function TeamOverview() {
  const { member, members, ready, pending } = useSession();

  if (!ready) return <Skeleton className="h-96 rounded-3xl" />;

  if (!member && pending) return <PendingApproval account={pending} className="max-w-2xl" />;

  if (!member) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-3xl border bg-card px-6 py-16 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
          <Lock className="size-7" aria-hidden="true" />
        </span>
        <h2 className="text-xl font-extrabold">This area is for the ESN Frankfurt team</h2>
        <p className="max-w-md text-muted-foreground">
          Sign in to see your shifts and tasks and the list of team members.
        </p>
        <SignInButton variant="default" label="Sign in" />
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      <MyAssignments member={member} />
      <MemberDirectory
        members={members}
        currentId={member.id}
        canManage={canManageMembers(member)}
      />
    </div>
  );
}

function MyAssignments({ member }: { member: Member }) {
  const { data: tasks, isPending } = useMemberTasks(member.id);
  const { events } = useEvents();
  const today = useClientToday();
  const [showPast, setShowPast] = useState(false);

  const rows = useMemo(() => {
    if (!tasks) return [];
    return tasks
      .map((task) => {
        const event = events.find((e) => e.slug === task.eventSlug);
        return { task, event, date: task.date ?? event?.startDate ?? "" };
      })
      .sort((a, b) =>
        a.date === b.date
          ? (a.task.startTime ?? "99").localeCompare(b.task.startTime ?? "99")
          : a.date.localeCompare(b.date),
      );
  }, [tasks, events]);

  const upcoming = rows.filter((r) => !r.task.done && (!today || r.date >= today));
  const past = rows.filter((r) => !upcoming.includes(r));
  const list = showPast ? past : upcoming;

  return (
    <section id="my-shifts" aria-labelledby="my-shifts-heading" className="scroll-mt-24">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="my-shifts-heading" className="text-xl font-extrabold tracking-tight">
            My shifts & tasks
          </h2>
          <p className="text-sm text-muted-foreground">
            Everything you&apos;ve signed up for or been assigned to.
          </p>
        </div>
        <div role="group" aria-label="Show" className="flex rounded-full bg-secondary p-1">
          {(
            [
              [false, `Upcoming (${upcoming.length})`],
              [true, `Done & past (${past.length})`],
            ] as const
          ).map(([value, label]) => (
            <button
              key={label}
              type="button"
              aria-pressed={showPast === value}
              onClick={() => setShowPast(value)}
              className={cn(
                "h-8 rounded-full px-3 text-sm font-semibold transition",
                showPast === value
                  ? "bg-card text-primary shadow-sm"
                  : "text-secondary-foreground/70",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {isPending ? (
        <Skeleton className="h-48 rounded-2xl" />
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed bg-card px-6 py-12 text-center">
          <ClipboardList className="size-8 text-muted-foreground" aria-hidden="true" />
          <p className="font-semibold">
            {showPast ? "Nothing here yet" : "No upcoming shifts or tasks"}
          </p>
          {!showPast && (
            <p className="text-sm text-muted-foreground">
              Open an event and look for spots that still need people.{" "}
              <Link
                href="/"
                className="font-semibold text-primary underline-offset-4 hover:underline"
              >
                Browse events
              </Link>
            </p>
          )}
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {list.map(({ task, event, date }) => (
            <li key={task.id}>
              <a
                href={`/events/${task.eventSlug}#team`}
                className="flex gap-4 rounded-2xl border bg-card p-4 transition hover:border-primary/25 hover:shadow-sm"
              >
                <span className="flex w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-accent py-2 text-accent-foreground">
                  {date ? (
                    <>
                      <span className="text-[0.65rem] font-bold uppercase">
                        {formatShortDate(date).split(",")[0]}
                      </span>
                      <span className="text-xl leading-none font-extrabold">
                        {date.slice(8, 10).replace(/^0/, "")}
                      </span>
                    </>
                  ) : (
                    <ClipboardList className="size-5" aria-hidden="true" />
                  )}
                </span>
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">
                    {task.kind === "shift" ? "Shift" : "Task"} · {event?.title ?? "Event"}
                  </span>
                  <span
                    className={cn("font-bold", task.done && "text-muted-foreground line-through")}
                  >
                    {task.title}
                  </span>
                  <span className="flex flex-wrap gap-x-3 text-sm text-muted-foreground">
                    {(formatTimeRange(task) || date) && (
                      <span className="flex items-center gap-1">
                        <CalendarClock className="size-3.5" aria-hidden="true" />
                        {[date && formatShortDate(date), formatTimeRange(task)]
                          .filter(Boolean)
                          .join(", ")}
                      </span>
                    )}
                    {task.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="size-3.5" aria-hidden="true" />
                        {task.location}
                      </span>
                    )}
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function MemberDirectory({
  members,
  currentId,
  canManage,
}: {
  members: Member[];
  currentId: string;
  canManage: boolean;
}) {
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<MemberRole | "all">("all");
  const filtered = members.filter(
    (m) =>
      (role === "all" || m.role === role) &&
      `${m.name} ${m.team ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <section
      aria-labelledby="members-heading"
      className="rounded-3xl border bg-card p-5 lg:sticky lg:top-[calc(var(--header-height)+1.5rem)]"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="members-heading" className="text-lg font-extrabold">
          Team members <span className="text-muted-foreground">({members.length})</span>
        </h2>
        {canManage && (
          <Button asChild size="sm" variant="outline">
            <Link href="/moderation">
              <ShieldCheck />
              Manage people
            </Link>
          </Button>
        )}
      </div>
      <div className="relative mt-3">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <TextField
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or team"
          aria-label="Search members"
          className="pl-9"
        />
      </div>
      <div role="group" aria-label="Role" className="mt-3 flex flex-wrap gap-1.5">
        {(["all", ...MEMBER_ROLES] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={role === value}
            onClick={() => setRole(value)}
            className={cn(
              "h-7 rounded-full px-3 text-xs font-semibold transition",
              role === value
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground",
            )}
          >
            {value === "all" ? "All" : MEMBER_ROLE_LABELS[value]}
          </button>
        ))}
      </div>
      <ul className="mt-3 flex flex-col gap-1">
        {filtered.map((m) => (
          <li key={m.id} className="flex items-center gap-3 rounded-xl p-2">
            <MemberAvatar member={m} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-semibold">
                {m.name}
                {m.id === currentId && <span className="text-muted-foreground"> (you)</span>}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {MEMBER_ROLE_LABELS[m.role]}
                {m.team ? ` · ${m.team}` : ""}
              </span>
            </span>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="py-6 text-center text-sm text-muted-foreground">No members found</li>
        )}
      </ul>
    </section>
  );
}
