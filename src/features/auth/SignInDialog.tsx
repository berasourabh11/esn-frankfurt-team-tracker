"use client";

import { useId, useState } from "react";
import type { VariantProps } from "class-variance-authority";
import { LogIn, ShieldCheck, UserPlus } from "lucide-react";

import { Button, type buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, TextField } from "@/components/ui/form-controls";
import { MemberAvatar } from "@/components/ui/member-avatar";
import {
  MEMBER_ROLE_LABELS,
  MEMBER_ROLES,
  MIN_PASSWORD_LENGTH,
  RegisterSchema,
} from "@/types/team";

import { useSession } from "./session";

/**
 * Team sign-in: e-mail + password with the API, or "pick a demo member" in
 * demo mode. The rest of the UI only depends on `useSession()`.
 */
export function SignInButton({
  label = "Team sign in",
  variant = "outline",
  size,
  className,
  labelClassName,
}: {
  label?: string;
  className?: string;
  labelClassName?: string;
} & VariantProps<typeof buttonVariants>) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"sign-in" | "register">("sign-in");
  const { members, signIn, mode } = useSession();
  const registering = mode === "api" && view === "register";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setView("sign-in");
      }}
    >
      <DialogTrigger asChild>
        <Button variant={variant} size={size} className={className}>
          <LogIn />
          <span className={labelClassName}>{label}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md gap-5 p-6 sm:p-7">
        <DialogHeader className="pr-8">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md">
            <ShieldCheck className="size-6" aria-hidden="true" />
          </span>
          <DialogTitle>
            {registering ? "Create an account" : "Sign in to the ESN team area"}
          </DialogTitle>
          <DialogDescription>
            {registering
              ? "A moderator checks new accounts and decides your role. You can sign in right away and will get access once you are accepted."
              : mode === "api"
                ? "Use the e-mail address and password of your ESN Frankfurt account."
                : "Demo mode: choose a member to see the app with their role."}
          </DialogDescription>
        </DialogHeader>

        {registering ? (
          <RegisterForm onDone={() => setOpen(false)} onSignIn={() => setView("sign-in")} />
        ) : mode === "api" ? (
          <PasswordSignIn onDone={() => setOpen(false)} onRegister={() => setView("register")} />
        ) : (
          <div className="flex max-h-[55dvh] flex-col gap-4 overflow-y-auto pr-1">
            {MEMBER_ROLES.map((role) => {
              const group = members.filter((m) => m.role === role);
              if (!group.length) return null;
              return (
                <section key={role} aria-label={MEMBER_ROLE_LABELS[role]}>
                  <h3 className="mb-1.5 text-xs font-bold tracking-wide text-muted-foreground uppercase">
                    {MEMBER_ROLE_LABELS[role]}
                  </h3>
                  <ul className="flex flex-col gap-1">
                    {group.map((member) => (
                      <li key={member.id}>
                        <button
                          type="button"
                          onClick={() => {
                            signIn(member.id);
                            setOpen(false);
                          }}
                          className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                        >
                          <MemberAvatar member={member} />
                          <span className="flex min-w-0 flex-col">
                            <span className="font-semibold">{member.name}</span>
                            <span className="truncate text-xs text-muted-foreground">
                              {member.team ? `${member.team} · ` : ""}
                              {MEMBER_ROLE_LABELS[member.role]}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PasswordSignIn({ onDone, onRegister }: { onDone: () => void; onRegister: () => void }) {
  const id = useId();
  const { signInWithPassword } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");
    if (!email || !password) {
      setError("Enter your e-mail and password.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signInWithPassword(email, password);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't sign in. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <Field id={`${id}-email`} label="E-mail">
        <TextField name="email" type="email" autoComplete="username" autoFocus required />
      </Field>
      <Field id={`${id}-password`} label="Password">
        <TextField name="password" type="password" autoComplete="current-password" required />
      </Field>
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-destructive/10 p-3 text-sm font-semibold text-destructive"
        >
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy}>
        <LogIn />
        {busy ? "Signing in…" : "Sign in"}
      </Button>
      <p className="text-sm text-muted-foreground">
        New here?{" "}
        <button
          type="button"
          onClick={onRegister}
          className="font-semibold text-primary underline-offset-4 hover:underline"
        >
          Create an account
        </button>
      </p>
      <p className="text-xs text-muted-foreground">Forgot your password? Ask a moderator.</p>
    </form>
  );
}

function RegisterForm({ onDone, onSignIn }: { onDone: () => void; onSignIn: () => void }) {
  const id = useId();
  const { register } = useSession();
  const [errors, setErrors] = useState<
    Partial<Record<"name" | "email" | "password" | "repeat" | "form", string>>
  >({});
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const result = RegisterSchema.safeParse({
      name: String(data.get("name") ?? ""),
      email: String(data.get("email") ?? ""),
      password: String(data.get("password") ?? ""),
    });
    const next: typeof errors = {};
    if (!result.success) {
      for (const issue of result.error.issues) {
        const key = issue.path[0] as "name" | "email" | "password";
        next[key] ??= issue.message;
      }
    } else if (result.data.password !== String(data.get("repeat") ?? "")) {
      next.repeat = "The passwords don't match";
    }
    setErrors(next);
    if (!result.success || Object.keys(next).length) {
      const first = Object.keys(next)[0];
      if (first) (e.currentTarget.elements.namedItem(first) as HTMLElement | null)?.focus();
      return;
    }
    setBusy(true);
    try {
      await register(result.data);
      onDone();
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : "Couldn't create the account." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <Field id={`${id}-name`} label="Your name" error={errors.name}>
        <TextField name="name" autoComplete="name" maxLength={80} autoFocus />
      </Field>
      <Field id={`${id}-email`} label="E-mail" error={errors.email}>
        <TextField name="email" type="email" autoComplete="email" />
      </Field>
      <Field
        id={`${id}-password`}
        label="Password"
        hint={`At least ${MIN_PASSWORD_LENGTH} characters`}
        error={errors.password}
      >
        <TextField name="password" type="password" autoComplete="new-password" />
      </Field>
      <Field id={`${id}-repeat`} label="Repeat password" error={errors.repeat}>
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
      <Button type="submit" disabled={busy}>
        <UserPlus />
        {busy ? "Creating account…" : "Create account"}
      </Button>
      <p className="text-sm text-muted-foreground">
        Already have an account?{" "}
        <button
          type="button"
          onClick={onSignIn}
          className="font-semibold text-primary underline-offset-4 hover:underline"
        >
          Sign in
        </button>
      </p>
    </form>
  );
}
