"use client";

import { useId, useState } from "react";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, NativeSelect, TextField } from "@/components/ui/form-controls";
import { useSession } from "@/features/auth/session";
import { useMemberMutations } from "@/services/teamClient";
import {
  MEMBER_ROLE_DESCRIPTIONS,
  MEMBER_ROLE_LABELS,
  MEMBER_ROLES,
  MIN_PASSWORD_LENGTH,
  MemberFormSchema,
  type Member,
  type MemberFormValues,
} from "@/types/team";

type Errors = Partial<Record<keyof MemberFormValues | "form", string>>;

/** Add an account, or edit/remove one (moderators only). */
export function MemberFormDialog({
  open,
  onOpenChange,
  member,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present when editing. */
  member?: Member;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-5 p-6 sm:p-7">
        {open && <MemberForm member={member} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function MemberForm({ member, onDone }: { member?: Member; onDone: () => void }) {
  const id = useId();
  const { mode, member: viewer } = useSession();
  const { createMember, updateMember, deleteMember } = useMemberMutations();
  const [errors, setErrors] = useState<Errors>({});
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const busy = createMember.isPending || updateMember.isPending || deleteMember.isPending;
  const usesPasswords = mode === "api";
  const isSelf = member?.id === viewer?.id;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const text = (name: string) => String(data.get(name) ?? "").trim() || undefined;
    const password = String(data.get("password") ?? "") || undefined;
    const result = MemberFormSchema.safeParse({
      name: text("name") ?? "",
      email: text("email") ?? "",
      role: text("role"),
      team: text("team"),
      password: usesPasswords ? password : undefined,
    });
    const next: Errors = {};
    if (!result.success) {
      for (const issue of result.error.issues) {
        const key = (issue.path[0] as keyof MemberFormValues) ?? "form";
        next[key] ??= issue.message;
      }
    } else if (usesPasswords && !member && !result.data.password) {
      next.password = "Set a first password for the account";
    }
    setErrors(next);
    if (Object.keys(next).length || !result.success) {
      const first = Object.keys(next)[0];
      if (first) (e.currentTarget.elements.namedItem(first) as HTMLElement | null)?.focus();
      return;
    }
    try {
      if (member) {
        await updateMember.mutateAsync({
          memberId: member.id,
          patch: { ...result.data, team: result.data.team ?? "" },
        });
      } else {
        await createMember.mutateAsync(result.data);
      }
      onDone();
    } catch (error) {
      setErrors({ form: error instanceof Error ? error.message : "Couldn't save the account." });
    }
  }

  async function remove() {
    if (!member) return;
    try {
      await deleteMember.mutateAsync(member.id);
      onDone();
    } catch (error) {
      setConfirmingRemove(false);
      setErrors({ form: error instanceof Error ? error.message : "Couldn't remove the account." });
    }
  }

  if (confirmingRemove && member) {
    return (
      <>
        <DialogHeader className="pr-8">
          <DialogTitle>Remove {member.name}?</DialogTitle>
          <DialogDescription>
            Their account is deleted and they are taken off all shifts and as host. Their review
            notes stay. This can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setConfirmingRemove(false)}>
            Keep account
          </Button>
          <Button
            className="bg-destructive text-white hover:bg-destructive/90"
            onClick={remove}
            disabled={busy}
          >
            <Trash2 />
            Remove account
          </Button>
        </DialogFooter>
      </>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <DialogHeader className="pr-8">
        <DialogTitle>{member ? "Edit account" : "Add account"}</DialogTitle>
        <DialogDescription>
          {member
            ? "Change the details or role."
            : usesPasswords
              ? "Creates an account. Share the first password with them; they can change it after signing in."
              : "Demo mode: the account is saved in this browser only."}
        </DialogDescription>
      </DialogHeader>

      <Field id={`${id}-name`} label="Name" error={errors.name}>
        <TextField name="name" defaultValue={member?.name} maxLength={80} autoFocus />
      </Field>
      <Field id={`${id}-email`} label="E-mail" error={errors.email}>
        <TextField
          name="email"
          type="email"
          autoComplete="off"
          defaultValue={member?.email}
          maxLength={120}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${id}-role`} label="Role" error={errors.role}>
          <NativeSelect name="role" defaultValue={member?.role ?? "user"}>
            {MEMBER_ROLES.map((role) => (
              <option key={role} value={role}>
                {MEMBER_ROLE_LABELS[role]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field id={`${id}-team`} label="Team" hint="Optional, e.g. Events" error={errors.team}>
          <TextField name="team" defaultValue={member?.team} maxLength={60} />
        </Field>
      </div>
      <ul className="flex flex-col gap-1 rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
        {MEMBER_ROLES.map((role) => (
          <li key={role}>
            <span className="font-semibold text-foreground">{MEMBER_ROLE_LABELS[role]}:</span>{" "}
            {MEMBER_ROLE_DESCRIPTIONS[role]}
          </li>
        ))}
      </ul>
      {usesPasswords && (
        <Field
          id={`${id}-password`}
          label={member ? "New password" : "First password"}
          hint={
            member
              ? `Optional. Sets a new password and signs them out (min. ${MIN_PASSWORD_LENGTH} characters).`
              : `At least ${MIN_PASSWORD_LENGTH} characters`
          }
          error={errors.password}
        >
          <TextField name="password" type="password" autoComplete="new-password" />
        </Field>
      )}

      {errors.form && (
        <p
          role="alert"
          className="rounded-xl bg-destructive/10 p-3 text-sm font-semibold text-destructive"
        >
          {errors.form}
        </p>
      )}

      <DialogFooter className="sm:justify-between">
        {member && !isSelf ? (
          <Button
            type="button"
            variant="ghost"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setConfirmingRemove(true)}
          >
            <Trash2 />
            Remove account
          </Button>
        ) : (
          <span />
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {member ? "Save changes" : "Add account"}
          </Button>
        </div>
      </DialogFooter>
    </form>
  );
}
