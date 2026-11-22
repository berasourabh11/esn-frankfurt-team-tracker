"use client";

import { useMemo, useState } from "react";
import { Check, Search } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TextField } from "@/components/ui/form-controls";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { cn } from "@/lib/utils";
import { openSpots } from "@/services/teamService";
import { MEMBER_ROLE_LABELS, type EventTask, type Member } from "@/types/team";

/** Organisers pick who takes a task. Toggling applies immediately. */
export function AssignDialog({
  open,
  onOpenChange,
  task,
  members,
  busyIds,
  onToggle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: EventTask;
  members: Member[];
  /** Members whose assignment is currently being saved. */
  busyIds: string[];
  onToggle: (memberId: string, assigned: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? members.filter((m) => `${m.name} ${m.team ?? ""}`.toLowerCase().includes(q))
      : members;
    // Assigned members first.
    return [...list].sort(
      (a, b) =>
        Number(task.assigneeIds.includes(b.id)) - Number(task.assigneeIds.includes(a.id)) ||
        a.name.localeCompare(b.name),
    );
  }, [members, query, task.assigneeIds]);

  const spots = openSpots(task);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-4 p-6 sm:p-7">
        <DialogHeader className="pr-8">
          <DialogTitle>Assign people</DialogTitle>
          <DialogDescription>
            {task.title} · {task.assigneeIds.length} of {task.peopleNeeded} assigned
            {spots === 0 ? " (full)" : ` · ${spots} open`}
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <TextField
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search members"
            aria-label="Search members"
            className="pl-9"
          />
        </div>

        <ul className="-mx-2 flex max-h-[50dvh] flex-col gap-0.5 overflow-y-auto">
          {filtered.map((member) => {
            const assigned = task.assigneeIds.includes(member.id);
            const disabled = (!assigned && spots === 0) || busyIds.includes(member.id);
            return (
              <li key={member.id}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={assigned}
                  disabled={disabled}
                  onClick={() => onToggle(member.id, assigned)}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left transition hover:bg-muted focus-visible:bg-muted focus-visible:outline-none disabled:opacity-45"
                >
                  <MemberAvatar member={member} size="sm" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-semibold">{member.name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {MEMBER_ROLE_LABELS[member.role]}
                      {member.team ? ` · ${member.team}` : ""}
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex size-5 items-center justify-center rounded-md border",
                      assigned
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input",
                    )}
                  >
                    {assigned && <Check className="size-3.5" />}
                  </span>
                </button>
              </li>
            );
          })}
          {filtered.length === 0 && (
            <li className="px-2 py-6 text-center text-sm text-muted-foreground">
              No members found
            </li>
          )}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
