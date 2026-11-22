"use client";

import { useId, useState } from "react";
import { Clock, ListChecks } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, Textarea, TextField } from "@/components/ui/form-controls";
import { cn } from "@/lib/utils";
import { TaskFormSchema, type EventTask, type TaskFormValues, type TaskKind } from "@/types/team";

export interface TaskFormEventInfo {
  startDate: string;
  endDate?: string;
}

type Errors = Partial<Record<keyof TaskFormValues | "form", string>>;

/** Create or edit a shift/task. Validates with the shared Zod schema. */
export function TaskFormDialog({
  open,
  onOpenChange,
  event,
  task,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: TaskFormEventInfo;
  /** Present when editing. */
  task?: EventTask;
  onSubmit: (values: TaskFormValues) => Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-5 p-6 sm:p-7">
        {/* Remount the form for each open so fields start from the right values. */}
        {open && (
          <TaskForm
            event={event}
            task={task}
            onCancel={() => onOpenChange(false)}
            onSubmit={onSubmit}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function TaskForm({
  event,
  task,
  onCancel,
  onSubmit,
}: {
  event: TaskFormEventInfo;
  task?: EventTask;
  onCancel: () => void;
  onSubmit: (values: TaskFormValues) => Promise<void>;
}) {
  const id = useId();
  const [kind, setKind] = useState<TaskKind>(task?.kind ?? "shift");
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const minPeople = Math.max(1, task?.assigneeIds.length ?? 1);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const text = (name: string) => {
      const value = String(data.get(name) ?? "").trim();
      return value === "" ? undefined : value;
    };
    const result = TaskFormSchema.safeParse({
      kind,
      title: text("title") ?? "",
      description: text("description") ?? "",
      date: text("date"),
      startTime: text("startTime"),
      endTime: text("endTime"),
      location: text("location"),
      peopleNeeded: text("peopleNeeded") ?? "",
    });
    if (!result.success) {
      const next: Errors = {};
      for (const issue of result.error.issues) {
        const key = (issue.path[0] as keyof TaskFormValues) ?? "form";
        next[key] ??= issue.message;
      }
      setErrors(next);
      return;
    }
    if (result.data.peopleNeeded < minPeople) {
      setErrors({ peopleNeeded: `${minPeople} people are already assigned` });
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(result.data);
    } catch (error) {
      setErrors({ form: error instanceof Error ? error.message : "Something went wrong." });
    } finally {
      setSubmitting(false);
    }
  }

  const isShift = kind === "shift";

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <DialogHeader className="pr-8">
        <DialogTitle>
          {task ? "Edit" : "New"} {isShift ? "shift" : "task"}
        </DialogTitle>
        <DialogDescription>
          {isShift
            ? "A time slot at the event, e.g. welcome desk, group leader or photos."
            : "Something to prepare or follow up, e.g. booking tickets or posting on Instagram."}
        </DialogDescription>
      </DialogHeader>

      <div role="radiogroup" aria-label="Type" className="grid grid-cols-2 gap-2">
        {(
          [
            ["shift", "Shift", Clock],
            ["task", "Task", ListChecks],
          ] as const
        ).map(([value, label, Icon]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={kind === value}
            onClick={() => setKind(value)}
            className={cn(
              "flex h-11 items-center justify-center gap-2 rounded-xl border text-sm font-semibold transition",
              kind === value
                ? "border-primary bg-accent text-primary"
                : "border-input bg-card hover:bg-muted",
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      <Field id={`${id}-title`} label="Title" error={errors.title}>
        <TextField
          name="title"
          defaultValue={task?.title}
          placeholder={isShift ? "e.g. Welcome desk" : "e.g. Book group tickets"}
          maxLength={80}
          autoFocus
        />
      </Field>

      <Field
        id={`${id}-description`}
        label="Description"
        hint="What does the person need to do? Anything to bring?"
        error={errors.description}
      >
        <Textarea name="description" defaultValue={task?.description} maxLength={1000} rows={3} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          id={`${id}-date`}
          label={isShift ? "Date" : "Due date"}
          hint={isShift ? undefined : "Optional"}
          error={errors.date}
        >
          <TextField
            name="date"
            type="date"
            defaultValue={task?.date ?? (isShift ? event.startDate : undefined)}
            min={isShift ? event.startDate : undefined}
            max={isShift ? (event.endDate ?? event.startDate) : undefined}
          />
        </Field>
        <Field
          id={`${id}-start`}
          label={isShift ? "Start" : "Time"}
          hint={isShift ? undefined : "Optional"}
          error={errors.startTime}
        >
          <TextField name="startTime" type="time" defaultValue={task?.startTime} />
        </Field>
        <Field id={`${id}-end`} label="End" hint="Optional" error={errors.endTime}>
          <TextField name="endTime" type="time" defaultValue={task?.endTime} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
        <Field id={`${id}-location`} label="Meeting point" hint="Optional" error={errors.location}>
          <TextField name="location" defaultValue={task?.location} maxLength={120} />
        </Field>
        <Field id={`${id}-people`} label="People needed" error={errors.peopleNeeded}>
          <TextField
            name="peopleNeeded"
            type="number"
            inputMode="numeric"
            min={minPeople}
            max={50}
            defaultValue={task?.peopleNeeded ?? (isShift ? 2 : 1)}
          />
        </Field>
      </div>

      {errors.form && (
        <p
          role="alert"
          className="rounded-xl bg-destructive/10 p-3 text-sm font-semibold text-destructive"
        >
          {errors.form}
        </p>
      )}

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {task ? "Save changes" : `Add ${isShift ? "shift" : "task"}`}
        </Button>
      </DialogFooter>
    </form>
  );
}
