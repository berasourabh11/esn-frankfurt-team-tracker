"use client";

import { MemberAvatar } from "@/components/ui/member-avatar";
import { formatShortDate } from "@/lib/dateUtils";
import { cn } from "@/lib/utils";
import { openSpots } from "@/services/teamService";
import type { EventTask, Member } from "@/types/team";

const toMinutes = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

export interface PlannedShift {
  task: EventTask;
  start: number;
  end: number;
}

/** Turns timed shifts into minute ranges; shifts without an end last one hour. */
export function planShifts(tasks: readonly EventTask[], fallbackDate: string) {
  const byDate = new Map<string, PlannedShift[]>();
  for (const task of tasks) {
    if (task.kind !== "shift" || !task.startTime) continue;
    const start = toMinutes(task.startTime);
    let end = task.endTime ? toMinutes(task.endTime) : start + 60;
    if (end <= start) end += 24 * 60; // runs past midnight
    const date = task.date ?? fallbackDate;
    byDate.set(date, [...(byDate.get(date) ?? []), { task, start, end }]);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, shifts]) => {
      const from = Math.floor(Math.min(...shifts.map((s) => s.start)) / 60) * 60;
      const to = Math.ceil(Math.max(...shifts.map((s) => s.end)) / 60) * 60;
      return { date, from, to, shifts: shifts.sort((a, b) => a.start - b.start || a.end - b.end) };
    });
}

/**
 * Visual shift plan: one timeline per day, one bar per shift, coloured by
 * staffing (full / partly staffed / nobody yet). Clicking a bar jumps to the
 * shift's card below.
 */
export function ShiftPlan({
  tasks,
  members,
  eventStartDate,
  viewerId,
}: {
  tasks: readonly EventTask[];
  members: Member[];
  eventStartDate: string;
  viewerId: string;
}) {
  const days = planShifts(tasks, eventStartDate);
  if (days.length === 0) return null;

  return (
    <section aria-labelledby="shift-plan-heading" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3
          id="shift-plan-heading"
          className="text-sm font-bold tracking-wide text-muted-foreground uppercase"
        >
          Shift plan
        </h3>
        <ul className="flex flex-wrap gap-3 text-xs text-muted-foreground" aria-label="Legend">
          <Legend className="bg-[#7AC143]" label="Fully staffed" />
          <Legend className="bg-[#F5A524]" label="Needs more people" />
          <Legend className="bg-[#EC4E7B]" label="Nobody yet" />
        </ul>
      </div>

      {days.map((day) => {
        const span = day.to - day.from;
        const hours = Array.from({ length: span / 60 + 1 }, (_, i) => day.from + i * 60);
        const pct = (minutes: number) => ((minutes - day.from) / span) * 100;
        // At most ~5 labels so they never overlap, even on phones.
        const step = [1, 2, 3, 4, 6].find((s) => span / 60 / s <= 4) ?? 12;
        const labels = hours.filter((h) => ((h - day.from) / 60) % step === 0);

        return (
          <div key={day.date} className="rounded-2xl border bg-card p-3 sm:p-4">
            {days.length > 1 && (
              <p className="mb-2 text-sm font-bold">{formatShortDate(day.date)}</p>
            )}
            {/* Hour ruler */}
            <div className="relative mb-1 ml-0 h-5 sm:ml-44" aria-hidden="true">
              {labels.map((h) => (
                <span
                  key={h}
                  className={cn(
                    "absolute top-0 text-[0.7rem] font-semibold text-muted-foreground tabular-nums",
                    h === day.from
                      ? "translate-x-0"
                      : h === day.to
                        ? "-translate-x-full"
                        : "-translate-x-1/2",
                  )}
                  style={{ left: `${pct(h)}%` }}
                >
                  {String(Math.floor(h / 60) % 24).padStart(2, "0")}:00
                </span>
              ))}
            </div>

            <ul className="flex flex-col gap-2">
              {day.shifts.map(({ task, start, end }) => {
                const spots = openSpots(task);
                const filled = task.assigneeIds.length;
                const tone = task.done
                  ? "bg-muted-foreground/40"
                  : spots === 0
                    ? "bg-[#7AC143]"
                    : filled > 0
                      ? "bg-[#F5A524]"
                      : "bg-[#EC4E7B]";
                const assignees = task.assigneeIds
                  .map((id) => members.find((m) => m.id === id))
                  .filter((m): m is Member => !!m);
                const mine = task.assigneeIds.includes(viewerId);
                const time = `${task.startTime}${task.endTime ? `–${task.endTime}` : ""}`;

                return (
                  <li
                    key={task.id}
                    className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-0"
                  >
                    <div className="flex min-w-0 items-baseline gap-2 sm:w-44 sm:shrink-0 sm:flex-col sm:items-start sm:gap-0 sm:pr-3">
                      <span
                        className={cn(
                          "truncate text-sm font-semibold",
                          task.done && "text-muted-foreground line-through",
                        )}
                      >
                        {task.title}
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {time} · {filled}/{task.peopleNeeded}
                      </span>
                    </div>
                    {/* w-full + sm:flex-1: in the stacked mobile layout flex-1 would collapse the height. */}
                    <div className="relative h-9 w-full rounded-lg bg-muted/60 sm:w-auto sm:flex-1">
                      {hours.slice(1, -1).map((h) => (
                        <span
                          key={h}
                          aria-hidden="true"
                          className="absolute inset-y-0 w-px bg-border"
                          style={{ left: `${pct(h)}%` }}
                        />
                      ))}
                      <a
                        href={`#task-${task.id}`}
                        aria-label={`${task.title}, ${time}, ${filled} of ${task.peopleNeeded} people`}
                        className={cn(
                          "absolute inset-y-1 flex min-w-8 items-center gap-1 overflow-hidden rounded-md px-1.5 text-xs font-bold text-white shadow-sm transition hover:brightness-110 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                          tone,
                          mine && "ring-2 ring-primary ring-offset-1 ring-offset-card",
                        )}
                        style={{ left: `${pct(start)}%`, width: `${pct(end) - pct(start)}%` }}
                      >
                        <span className="flex -space-x-1.5">
                          {assignees.slice(0, 4).map((m) => (
                            <MemberAvatar
                              key={m.id}
                              member={m}
                              size="sm"
                              className="size-6 text-[0.55rem] ring-1"
                            />
                          ))}
                        </span>
                        {spots > 0 && !task.done && (
                          <span className="ml-auto shrink-0 rounded bg-black/20 px-1 whitespace-nowrap">
                            {pct(end) - pct(start) >= 25 ? `${spots} open` : `+${spots}`}
                          </span>
                        )}
                      </a>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </section>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <li className="flex items-center gap-1.5">
      <span className={cn("size-2.5 rounded-sm", className)} aria-hidden="true" />
      {label}
    </li>
  );
}
