"use client";

import { useMemo, useState } from "react";
import { Check, Pencil, Search, ShieldAlert, UserPlus, UserRoundCheck, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NativeSelect, TextField } from "@/components/ui/form-controls";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { PendingApproval } from "@/features/auth/PendingApproval";
import { canManageMembers } from "@/features/auth/permissions";
import { useSession } from "@/features/auth/session";
import { SignInButton } from "@/features/auth/SignInDialog";
import { useMemberMutations, useMembers } from "@/services/teamClient";
import {
  MEMBER_ROLE_DESCRIPTIONS,
  MEMBER_ROLE_LABELS,
  MEMBER_ROLES,
  isPending,
  type Member,
  type MemberRole,
} from "@/types/team";

import { MemberFormDialog } from "./MemberFormDialog";

const registeredAt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Berlin",
});

/**
 * Moderators accept new registrations, decide everyone's role and remove
 * accounts. The API enforces the same rules.
 */
export function ModerationPanel() {
  const { member, pending, ready } = useSession();

  if (!ready) return <Skeleton className="h-96 rounded-3xl" />;
  if (!member && pending) return <PendingApproval account={pending} className="max-w-2xl" />;
  if (!member) {
    return (
      <Notice title="Moderators only">
        <p className="max-w-md text-muted-foreground">Sign in with a moderator account.</p>
        <SignInButton variant="default" label="Sign in" />
      </Notice>
    );
  }
  if (!canManageMembers(member)) {
    return (
      <Notice title="Moderators only">
        <p className="max-w-md text-muted-foreground">
          You&apos;re signed in as a {MEMBER_ROLE_LABELS[member.role].toLowerCase()}. Ask a
          moderator if you need a different role.
        </p>
      </Notice>
    );
  }
  return <Moderation viewer={member} />;
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-3xl border bg-card px-6 py-16 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
        <ShieldAlert className="size-7" aria-hidden="true" />
      </span>
      <h2 className="text-xl font-extrabold">{title}</h2>
      {children}
    </div>
  );
}

function Moderation({ viewer }: { viewer: Member }) {
  const { data: everyone = [], isPending: loading } = useMembers();
  const mutations = useMemberMutations();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState<Member | "new" | null>(null);

  const waiting = useMemo(
    () =>
      everyone
        .filter(isPending)
        .sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? "")),
    [everyone],
  );
  const people = useMemo(() => everyone.filter((m) => !isPending(m)), [everyone]);

  async function run(action: () => Promise<unknown>, done: string) {
    setError(null);
    setMessage(null);
    try {
      await action();
      setMessage(done);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    }
  }

  if (loading) return <Skeleton className="h-96 rounded-3xl" />;

  return (
    <div className="flex flex-col gap-8">
      <div aria-live="polite" className="empty:hidden">
        {error && (
          <p
            role="alert"
            className="rounded-xl bg-destructive/10 p-3 text-sm font-semibold text-destructive"
          >
            {error}
          </p>
        )}
        {message && !error && (
          <p className="rounded-xl bg-accent p-3 text-sm font-semibold text-accent-foreground">
            {message}
          </p>
        )}
      </div>

      <WaitingList
        people={waiting}
        onAccept={(person, role) =>
          run(
            () => mutations.approveMember.mutateAsync({ memberId: person.id, role }),
            `${person.name} was accepted as ${MEMBER_ROLE_LABELS[role].toLowerCase()}.`,
          )
        }
        onReject={(person) =>
          run(
            () => mutations.deleteMember.mutateAsync(person.id),
            `${person.name}'s registration was rejected.`,
          )
        }
      />

      <PeopleList
        people={people}
        viewerId={viewer.id}
        onRoleChange={(person, role) =>
          run(
            () => mutations.updateMember.mutateAsync({ memberId: person.id, patch: { role } }),
            `${person.name} is now ${MEMBER_ROLE_LABELS[role].toLowerCase()}.`,
          )
        }
        onEdit={setEditing}
      />

      <MemberFormDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        member={editing === "new" || editing === null ? undefined : editing}
      />
    </div>
  );
}

function WaitingList({
  people,
  onAccept,
  onReject,
}: {
  people: Member[];
  onAccept: (person: Member, role: MemberRole) => Promise<void>;
  onReject: (person: Member) => Promise<void>;
}) {
  const [roles, setRoles] = useState<Record<string, MemberRole>>({});
  const [rejecting, setRejecting] = useState<Member | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  return (
    <section aria-labelledby="waiting-heading" className="rounded-3xl border bg-card p-5 sm:p-6">
      <h2 id="waiting-heading" className="text-lg font-extrabold">
        Waiting for approval <span className="text-muted-foreground">({people.length})</span>
      </h2>
      <p className="text-sm text-muted-foreground">
        People who registered themselves. Accept them with a role, or reject the registration.
      </p>

      {people.length === 0 ? (
        <p className="mt-4 flex items-center gap-2 rounded-2xl bg-muted/60 p-4 text-sm text-muted-foreground">
          <UserRoundCheck className="size-4" aria-hidden="true" />
          No one is waiting right now.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {people.map((person) => {
            const role = roles[person.id] ?? "user";
            const busy = busyId === person.id;
            return (
              <li
                key={person.id}
                aria-label={person.name}
                className="flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <MemberAvatar member={person} />
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{person.name}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {person.email}
                      {person.createdAt &&
                        ` · registered ${registeredAt.format(new Date(person.createdAt))}`}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <NativeSelect
                    aria-label={`Role for ${person.name}`}
                    value={role}
                    onChange={(e) =>
                      setRoles((r) => ({ ...r, [person.id]: e.target.value as MemberRole }))
                    }
                    className="w-auto"
                  >
                    {MEMBER_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {MEMBER_ROLE_LABELS[r]}
                      </option>
                    ))}
                  </NativeSelect>
                  <Button
                    size="sm"
                    disabled={busy}
                    aria-label={`Accept ${person.name}`}
                    onClick={async () => {
                      setBusyId(person.id);
                      await onAccept(person, role);
                      setBusyId(null);
                    }}
                  >
                    <Check />
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    aria-label={`Reject ${person.name}`}
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setRejecting(person)}
                  >
                    <X />
                    Reject
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={rejecting !== null} onOpenChange={(open) => !open && setRejecting(null)}>
        <DialogContent className="max-w-md gap-5 p-6 sm:p-7">
          {rejecting && (
            <>
              <DialogHeader className="pr-8">
                <DialogTitle>Reject {rejecting.name}?</DialogTitle>
                <DialogDescription>
                  The registration is deleted. They can register again later.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setRejecting(null)}>
                  Cancel
                </Button>
                <Button
                  className="bg-destructive text-white hover:bg-destructive/90"
                  onClick={async () => {
                    const person = rejecting;
                    setRejecting(null);
                    await onReject(person);
                  }}
                >
                  Reject registration
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function PeopleList({
  people,
  viewerId,
  onRoleChange,
  onEdit,
}: {
  people: Member[];
  viewerId: string;
  onRoleChange: (person: Member, role: MemberRole) => Promise<void>;
  onEdit: (person: Member | "new") => void;
}) {
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<MemberRole | "all">("all");
  const counts = Object.fromEntries(
    MEMBER_ROLES.map((r) => [r, people.filter((p) => p.role === r).length]),
  ) as Record<MemberRole, number>;
  const q = query.trim().toLowerCase();
  const filtered = people.filter(
    (p) =>
      (roleFilter === "all" || p.role === roleFilter) &&
      `${p.name} ${p.email ?? ""} ${p.team ?? ""}`.toLowerCase().includes(q),
  );

  return (
    <section aria-labelledby="people-heading" className="rounded-3xl border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="people-heading" className="text-lg font-extrabold">
            People &amp; roles <span className="text-muted-foreground">({people.length})</span>
          </h2>
          <p className="text-sm text-muted-foreground">Changing a role takes effect immediately.</p>
        </div>
        <Button size="sm" onClick={() => onEdit("new")}>
          <UserPlus />
          Add account
        </Button>
      </div>

      <dl className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {MEMBER_ROLES.map((r) => (
          <div key={r} className="rounded-2xl bg-muted/60 p-3">
            <dt className="text-sm font-bold">
              {MEMBER_ROLE_LABELS[r]}{" "}
              <span className="font-normal text-muted-foreground">({counts[r]})</span>
            </dt>
            <dd className="text-xs text-muted-foreground">{MEMBER_ROLE_DESCRIPTIONS[r]}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <TextField
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, e-mail or team"
            aria-label="Search people"
            className="pl-9"
          />
        </div>
        <NativeSelect
          aria-label="Filter by role"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as MemberRole | "all")}
          className="sm:w-44"
        >
          <option value="all">All roles</option>
          {MEMBER_ROLES.map((r) => (
            <option key={r} value={r}>
              {MEMBER_ROLE_LABELS[r]}
            </option>
          ))}
        </NativeSelect>
      </div>

      <ul className="mt-3 flex flex-col divide-y">
        {filtered.map((person) => (
          <li
            key={person.id}
            aria-label={person.name}
            className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center"
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <MemberAvatar member={person} />
              <div className="min-w-0">
                <p className="truncate font-semibold">
                  {person.name}
                  {person.id === viewerId && (
                    <span className="font-normal text-muted-foreground"> (you)</span>
                  )}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {[person.email, person.team].filter(Boolean).join(" · ")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 pl-12 sm:pl-0">
              <NativeSelect
                aria-label={`Role for ${person.name}`}
                value={person.role}
                onChange={(e) => void onRoleChange(person, e.target.value as MemberRole)}
                className={cn("w-auto", person.role === "moderator" && "font-semibold")}
              >
                {MEMBER_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {MEMBER_ROLE_LABELS[r]}
                  </option>
                ))}
              </NativeSelect>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Edit ${person.name}`}
                onClick={() => onEdit(person)}
              >
                <Pencil />
              </Button>
            </div>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="py-6 text-center text-sm text-muted-foreground">No one found</li>
        )}
      </ul>
    </section>
  );
}
