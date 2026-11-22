"use client";

import { useState } from "react";
import { ClipboardList, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { isMultiDay } from "@/lib/dateUtils";
import { cn } from "@/lib/utils";
import { canManageTasks, isAssigned } from "@/features/auth/permissions";
import { useEventTasks, useTeamMutations } from "@/services/teamClient";
import { isFull, summariseStaffing } from "@/services/teamService";
import type { EventTask, Member } from "@/types/team";

import { AssignDialog } from "./AssignDialog";
import { ShiftPlan } from "./ShiftPlan";
import { TaskCard } from "./TaskCard";
import { TaskFormDialog, type TaskFormEventInfo } from "./TaskFormDialog";

type Filter = "all" | "open" | "mine";

export function ShiftsAndTasks({
  event,
  viewer,
  members,
  onError,
}: {
  event: TaskFormEventInfo & { slug: string };
  viewer: Member;
  members: Member[];
  onError: (message: string) => void;
}) {
  const { data: tasks, isPending, isError } = useEventTasks(event.slug);
  const m = useTeamMutations(event.slug);
  const [filter, setFilter] = useState<Filter>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<EventTask | undefined>();
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<EventTask | null>(null);
  const [busy, setBusy] = useState<Record<string, string[]>>({});
  const manager = canManageTasks(viewer);

  /** Runs a mutation, tracking which task (and member) is busy and surfacing errors. */
  async function run(taskId: string, memberId: string, action: () => Promise<unknown>) {
    setBusy((b) => ({ ...b, [taskId]: [...(b[taskId] ?? []), memberId] }));
    try {
      await action();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setBusy((b) => ({ ...b, [taskId]: (b[taskId] ?? []).filter((id) => id !== memberId) }));
    }
  }

  if (isPending) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading shifts and tasks">
        <Skeleton className="h-14 rounded-2xl" />
        <Skeleton className="h-36 rounded-2xl" />
        <Skeleton className="h-36 rounded-2xl" />
      </div>
    );
  }
  if (isError || !tasks) {
    return <p role="alert">Shifts and tasks could not be loaded.</p>;
  }

  const summary = summariseStaffing(tasks);
  const visible = tasks.filter((t) =>
    filter === "open" ? !t.done && !isFull(t) : filter === "mine" ? isAssigned(viewer, t) : true,
  );
  const shifts = visible.filter((t) => t.kind === "shift");
  const todos = visible.filter((t) => t.kind === "task");
  const assigningTask = tasks.find((t) => t.id === assigningId);
  const multiDay = isMultiDay(event);
  const percent = summary.neededSpots
    ? Math.round((summary.filledSpots / summary.neededSpots) * 100)
    : 100;

  const cardFor = (task: EventTask) => (
    <li key={task.id}>
      <TaskCard
        task={task}
        members={members}
        viewer={viewer}
        showDate={multiDay || task.kind === "task"}
        busy={(busy[task.id]?.length ?? 0) > 0}
        actions={{
          onJoin: () =>
            run(task.id, viewer.id, () =>
              m.assign.mutateAsync({ taskId: task.id, memberId: viewer.id }),
            ),
          onLeave: () =>
            run(task.id, viewer.id, () =>
              m.unassign.mutateAsync({ taskId: task.id, memberId: viewer.id }),
            ),
          onUnassign: (memberId) =>
            run(task.id, memberId, () => m.unassign.mutateAsync({ taskId: task.id, memberId })),
          onAssign: () => setAssigningId(task.id),
          onToggleDone: () =>
            run(task.id, viewer.id, () =>
              m.updateTask.mutateAsync({ taskId: task.id, patch: { done: !task.done } }),
            ),
          onEdit: () => {
            setEditing(task);
            setFormOpen(true);
          },
          onDelete: () => setDeleting(task),
        }}
      />
    </li>
  );

  return (
    <div className="flex flex-col gap-5">
      {/* Staffing overview */}
      <div className="flex flex-col gap-3 rounded-2xl bg-muted/60 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {summary.neededSpots === 0 ? (
            <p className="text-sm text-muted-foreground">
              {summary.done > 0
                ? `All ${summary.done} done 🎉`
                : "No shifts planned yet — add the first one to start the plan."}
            </p>
          ) : (
            <>
              <p className="text-sm">
                <strong className="text-base">
                  {summary.filledSpots} of {summary.neededSpots}
                </strong>{" "}
                spots filled
                {summary.openTasks > 0 && (
                  <span className="text-muted-foreground">
                    {" "}
                    · {summary.openTasks} still need people
                  </span>
                )}
                {summary.done > 0 && (
                  <span className="text-muted-foreground"> · {summary.done} done</span>
                )}
              </p>
              <div
                role="progressbar"
                aria-label="Staffing"
                aria-valuenow={percent}
                aria-valuemin={0}
                aria-valuemax={100}
                className="h-2 w-full overflow-hidden rounded-full bg-border"
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand-cyan to-brand-blue transition-[width]"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </>
          )}
        </div>
        {manager && (
          <Button
            onClick={() => {
              setEditing(undefined);
              setFormOpen(true);
            }}
          >
            <Plus />
            Add shift or task
          </Button>
        )}
      </div>

      <ShiftPlan
        tasks={tasks}
        members={members}
        eventStartDate={event.startDate}
        viewerId={viewer.id}
      />

      <div role="group" aria-label="Show" className="flex flex-wrap gap-1.5">
        {(
          [
            ["all", `All (${tasks.length})`],
            ["open", "Needs people"],
            ["mine", "My tasks"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
            className={cn(
              "h-8 rounded-full px-3.5 text-sm font-semibold transition",
              filter === value
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/60",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tasks.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-10 text-center">
          <ClipboardList className="size-8 text-muted-foreground" aria-hidden="true" />
          <p className="font-semibold">No shifts or tasks yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {manager
              ? "Add shifts for the event itself and tasks for preparation, like booking or promotion."
              : "The organisers haven't added any shifts yet. Check back later."}
          </p>
        </div>
      ) : visible.length === 0 ? (
        <p className="rounded-2xl border border-dashed px-6 py-8 text-center text-sm text-muted-foreground">
          {filter === "mine"
            ? "You haven't taken any shifts or tasks for this event yet."
            : "Everything is staffed. 🎉"}
        </p>
      ) : (
        <>
          {shifts.length > 0 && (
            <section aria-labelledby={`${event.slug}-shifts`} className="flex flex-col gap-3">
              <h3
                id={`${event.slug}-shifts`}
                className="text-sm font-bold tracking-wide text-muted-foreground uppercase"
              >
                Shifts during the event
              </h3>
              <ul className="flex flex-col gap-3">{shifts.map(cardFor)}</ul>
            </section>
          )}
          {todos.length > 0 && (
            <section aria-labelledby={`${event.slug}-todos`} className="flex flex-col gap-3">
              <h3
                id={`${event.slug}-todos`}
                className="text-sm font-bold tracking-wide text-muted-foreground uppercase"
              >
                Tasks before & after
              </h3>
              <ul className="flex flex-col gap-3">{todos.map(cardFor)}</ul>
            </section>
          )}
        </>
      )}

      <TaskFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        event={event}
        task={editing}
        onSubmit={async (values) => {
          if (editing) await m.updateTask.mutateAsync({ taskId: editing.id, patch: values });
          else await m.createTask.mutateAsync({ values, createdBy: viewer.id });
          setFormOpen(false);
        }}
      />

      {assigningTask && (
        <AssignDialog
          open
          onOpenChange={(open) => !open && setAssigningId(null)}
          task={assigningTask}
          members={members}
          busyIds={busy[assigningTask.id] ?? []}
          onToggle={(memberId, assigned) =>
            run(assigningTask.id, memberId, () =>
              assigned
                ? m.unassign.mutateAsync({ taskId: assigningTask.id, memberId })
                : m.assign.mutateAsync({ taskId: assigningTask.id, memberId }),
            )
          }
        />
      )}

      <Dialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent className="max-w-sm gap-4 p-6" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete “{deleting?.title}”?</DialogTitle>
            <DialogDescription>
              {deleting?.assigneeIds.length
                ? `${deleting.assigneeIds.length} assigned ${deleting.assigneeIds.length === 1 ? "person" : "people"} will be removed from it. `
                : ""}
              This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                const target = deleting!;
                setDeleting(null);
                run(target.id, viewer.id, () => m.deleteTask.mutateAsync(target.id));
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
