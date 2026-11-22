"use client";

import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, TextField } from "@/components/ui/form-controls";
import { MIN_PASSWORD_LENGTH } from "@/types/team";

import { getAuthService } from "./session";

/** Lets a signed-in member change their own password (API mode only). */
export function ChangePasswordDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-5 p-6 sm:p-7">
        {open && <ChangePasswordForm onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function ChangePasswordForm({ onDone }: { onDone: () => void }) {
  const id = useId();
  const [errors, setErrors] = useState<{ next?: string; repeat?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const current = String(data.get("current") ?? "");
    const next = String(data.get("next") ?? "");
    const repeat = String(data.get("repeat") ?? "");
    const nextErrors: typeof errors = {};
    if (next.length < MIN_PASSWORD_LENGTH) {
      nextErrors.next = `Use at least ${MIN_PASSWORD_LENGTH} characters`;
    } else if (next !== repeat) {
      nextErrors.repeat = "The passwords don't match";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setBusy(true);
    try {
      await getAuthService().changePassword(current, next);
      setSaved(true);
    } catch (error) {
      setErrors({ form: error instanceof Error ? error.message : "Couldn't change the password." });
    } finally {
      setBusy(false);
    }
  }

  if (saved) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Password changed</DialogTitle>
          <DialogDescription>
            Use your new password next time. You were signed out on your other devices.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={onDone}>Done</Button>
        </DialogFooter>
      </>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <DialogHeader className="pr-8">
        <DialogTitle>Change password</DialogTitle>
        <DialogDescription>Other devices are signed out afterwards.</DialogDescription>
      </DialogHeader>
      <Field id={`${id}-current`} label="Current password">
        <TextField name="current" type="password" autoComplete="current-password" autoFocus />
      </Field>
      <Field
        id={`${id}-next`}
        label="New password"
        hint={`At least ${MIN_PASSWORD_LENGTH} characters`}
        error={errors.next}
      >
        <TextField name="next" type="password" autoComplete="new-password" />
      </Field>
      <Field id={`${id}-repeat`} label="Repeat new password" error={errors.repeat}>
        <TextField name="repeat" type="password" autoComplete="new-password" />
      </Field>
      {errors.form && (
        <p
          role="alert"
          className="rounded-xl bg-destructive/10 p-3 text-sm font-semibold text-destructive"
        >
          {errors.form}
        </p>
      )}
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          Change password
        </Button>
      </DialogFooter>
    </form>
  );
}
