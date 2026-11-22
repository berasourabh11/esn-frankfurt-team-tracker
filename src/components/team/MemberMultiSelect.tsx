"use client";

import { useMemo, useState } from "react";
import { Check, Search } from "lucide-react";

import { TextField } from "@/components/ui/form-controls";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { cn } from "@/lib/utils";
import { MEMBER_ROLE_LABELS, type Member } from "@/types/team";

/** Searchable checklist of members (e.g. picking event hosts). */
export function MemberMultiSelect({
  members,
  value,
  onChange,
  label,
  max,
  className,
}: {
  members: Member[];
  value: string[];
  onChange: (ids: string[]) => void;
  label: string;
  max?: number;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (
      q ? members.filter((m) => `${m.name} ${m.team ?? ""}`.toLowerCase().includes(q)) : members
    )
      .slice()
      .sort(
        (a, b) =>
          Number(value.includes(b.id)) - Number(value.includes(a.id)) ||
          a.name.localeCompare(b.name),
      );
  }, [members, query, value]);
  const full = max !== undefined && value.length >= max;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
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
          aria-label={`Search ${label.toLowerCase()}`}
          className="pl-9"
        />
      </div>
      <ul
        role="group"
        aria-label={label}
        className="flex max-h-56 flex-col gap-0.5 overflow-y-auto rounded-xl border p-1"
      >
        {filtered.map((member) => {
          const selected = value.includes(member.id);
          return (
            <li key={member.id}>
              <button
                type="button"
                role="checkbox"
                aria-checked={selected}
                disabled={!selected && full}
                onClick={() =>
                  onChange(
                    selected ? value.filter((id) => id !== member.id) : [...value, member.id],
                  )
                }
                className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition hover:bg-muted focus-visible:bg-muted focus-visible:outline-none disabled:opacity-45"
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
                    selected ? "border-primary bg-primary text-primary-foreground" : "border-input",
                  )}
                >
                  {selected && <Check className="size-3.5" />}
                </span>
              </button>
            </li>
          );
        })}
        {filtered.length === 0 && (
          <li className="px-2 py-4 text-center text-sm text-muted-foreground">No members found</li>
        )}
      </ul>
    </div>
  );
}
