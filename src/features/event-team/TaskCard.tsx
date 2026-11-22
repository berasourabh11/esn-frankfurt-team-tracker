"use client";

import {
  CalendarClock,
  Check,
  Clock,
  ListChecks,
  MapPin,
  MoreHorizontal,
  Pencil,
  Trash2,
  UserMinus,
  UserPlus,
  UsersRound,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { formatShortDate, formatTimeRange } from "@/lib/dateUtils";
import { cn } from "@/lib/utils";
import { canJoin, canManageTasks, canToggleDone, isAssigned } from "@/features/auth/permissions";
import { openSpots } from "@/services/teamService";
import type { EventTask, Member } from "@/types/team";

export interface TaskCardActions {
  onJoin: () => void;
  onLeave: () => void;
  onUnassign: (memberId: string) => void;
  onAssign: () => void;
  onToggleDone: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function TaskCard({
  task,
  members,
  viewer,
  showDate,
  busy,
  actions,
}: {
  task: EventTask;
  members: Member[];
  viewer: Member;
  /** Show the date (multi-day events, or tasks with a due date). */
  showDate: boolean;
  busy: boolean;
  actions: TaskCardActions;
}) {
  const manager = canManageTasks(viewer);
  const mine = isAssigned(viewer, task);
  const assignees = task.assigneeIds
    .map((id) => members.find((m) => m.id === id))
    .filter((m): m is Member => !!m);
  const spots = openSpots(task);
  const time = formatTimeRange(task);
  const Icon = task.kind === "shift" ? Clock : ListChecks;
  const titleId = `task-${task.id}-title`;

  return (
    <article
      id={`task-${task.id}`}
      aria-labelledby={titleId}
      aria-busy={busy || undefined}
      className={cn(
        "flex scroll-mt-24 flex-col gap-3 rounded-2xl border bg-card p-4 transition target:ring-[3px] target:ring-ring/50 sm:p-5",
        mine && !task.done && "border-primary/30 bg-accent/30",
        task.done && "bg-muted/50",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl",
            task.done
              ? "bg-brand-green/15 text-[#3D6B18]"
              : task.kind === "shift"
                ? "bg-accent text-accent-foreground"
                : "bg-secondary text-secondary-foreground",
          )}
        >
          {task.done ? (
            <Check className="size-5" />
          ) : (
            <Icon className="size-5" aria-hidden="true" />
          )}
        </span>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h4
              id={titleId}
              className={cn(
                "leading-snug font-bold",
                task.done && "text-muted-foreground line-through",
              )}
            >
              {task.title}
            </h4>
            {mine && <Badge className="bg-primary/90">You</Badge>}
            {task.done && <Badge variant="secondary">Done</Badge>}
            {!task.done && spots === 0 && (
              <Badge variant="secondary" className="bg-brand-green/15 text-[#3D6B18]">
                Fully staffed
              </Badge>
            )}
          </div>
          {(time || showDate || task.location) && (
            <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
              {(time || (showDate && task.date)) && (
                <span className="flex items-center gap-1">
                  <CalendarClock className="size-3.5" aria-hidden="true" />
                  {[showDate && task.date ? formatShortDate(task.date) : null, time]
                    .filter(Boolean)
                    .join(", ")}
                  {task.kind === "task" && task.date && " (due)"}
                </span>
              )}
              {task.location && (
                <span className="flex min-w-0 items-center gap-1">
                  <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
                  {task.location}
                </span>
              )}
            </p>
          )}
        </div>

        {manager && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`More actions for ${task.title}`}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-44">
              <DropdownMenuItem onSelect={actions.onEdit}>
                <Pencil />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={actions.onDelete}
                className="text-destructive focus:bg-destructive/10 focus:text-destructive"
              >
                <Trash2 />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {task.description && (
        <p className="text-sm whitespace-pre-line text-foreground/80">{task.description}</p>
      )}

      {/* Staffing */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="flex items-center gap-2">
          <ul className="flex items-center -space-x-1.5" aria-label="Assigned people">
            {assignees.map((member) => (
              <li key={member.id} className="group/avatar relative">
                <MemberAvatar member={member} size="sm" />
                {(manager || member.id === viewer.id) && !task.done && (
                  <button
                    type="button"
                    onClick={() =>
                      member.id === viewer.id ? actions.onLeave() : actions.onUnassign(member.id)
                    }
                    disabled={busy}
                    aria-label={`Remove ${member.name}`}
                    className="absolute -top-1.5 -right-1.5 hidden size-4 items-center justify-center rounded-full bg-foreground text-background group-focus-within/avatar:flex group-hover/avatar:flex"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </li>
            ))}
            {!task.done &&
              Array.from({ length: Math.min(spots, 6) }).map((_, i) => (
                <li
                  key={`open-${i}`}
                  aria-hidden="true"
                  className="size-7 rounded-full border-2 border-dashed border-muted-foreground/35 bg-card ring-2 ring-card"
                />
              ))}
          </ul>
          <span className="flex items-center gap-1 text-sm text-muted-foreground">
            <UsersRound className="size-4" aria-hidden="true" />
            <span>
              <strong className="text-foreground">{task.assigneeIds.length}</strong> of{" "}
              {task.peopleNeeded}
              {!task.done && spots > 0 && ` · ${spots} open`}
            </span>
          </span>
        </div>
        {assignees.length > 0 && (
          <p className="w-full text-xs text-muted-foreground sm:w-auto">
            {assignees.map((m) => m.name.split(" ")[0]).join(", ")}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {canJoin(viewer, task) && (
          <Button size="sm" onClick={actions.onJoin} disabled={busy}>
            <UserPlus />
            {task.kind === "shift" ? "Take this shift" : "I'll do it"}
          </Button>
        )}
        {mine && !task.done && (
          <Button size="sm" variant="outline" onClick={actions.onLeave} disabled={busy}>
            <UserMinus />
            Leave
          </Button>
        )}
        {manager && !task.done && (
          <Button size="sm" variant="outline" onClick={actions.onAssign} disabled={busy}>
            <UsersRound />
            Assign people
          </Button>
        )}
        {canToggleDone(viewer, task) && (
          <Button
            size="sm"
            variant="ghost"
            onClick={actions.onToggleDone}
            disabled={busy}
            aria-pressed={task.done}
          >
            <Check />
            {task.done ? "Reopen" : "Mark as done"}
          </Button>
        )}
      </div>
    </article>
  );
}
