"use client";

import { useState } from "react";
import Link from "next/link";
import { ClipboardList, KeyRound, LogOut, ShieldCheck, Users } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { MEMBER_ROLE_LABELS } from "@/types/team";

import { ChangePasswordDialog } from "./ChangePasswordDialog";
import { canManageMembers } from "./permissions";
import { useSession } from "./session";
import { SignInButton } from "./SignInDialog";

export function UserMenu() {
  const { member, pending, ready, signOut, mode } = useSession();
  const [changingPassword, setChangingPassword] = useState(false);

  if (!ready) return <span className="size-10 rounded-full bg-muted" aria-hidden="true" />;

  if (!member && pending) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          className="rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          aria-label={`Account menu for ${pending.name} (waiting for approval)`}
        >
          <MemberAvatar member={pending} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel className="flex flex-col">
            <span className="truncate text-sm font-bold">{pending.name}</span>
            <span className="text-xs font-normal text-muted-foreground">
              Waiting for a moderator to accept your account
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => void signOut()}>
            <LogOut />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  if (!member) {
    return (
      <SignInButton
        variant="ghost"
        label="Team"
        labelClassName="sr-only sm:not-sr-only"
        className="max-sm:size-10 max-sm:px-0"
      />
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          aria-label={`Account menu for ${member.name}`}
        >
          <MemberAvatar member={member} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel className="flex items-center gap-3">
            <MemberAvatar member={member} />
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-bold">{member.name}</span>
              <span className="text-xs text-muted-foreground">
                {MEMBER_ROLE_LABELS[member.role]}
                {member.team ? ` · ${member.team}` : ""}
              </span>
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/team#my-shifts">
              <ClipboardList />
              My shifts & tasks
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/team">
              <Users />
              Team members
            </Link>
          </DropdownMenuItem>
          {canManageMembers(member) && (
            <DropdownMenuItem asChild>
              <Link href="/moderation">
                <ShieldCheck />
                Moderation
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          {mode === "api" && (
            <DropdownMenuItem onSelect={() => setChangingPassword(true)}>
              <KeyRound />
              Change password
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => void signOut()}>
            <LogOut />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ChangePasswordDialog open={changingPassword} onOpenChange={setChangingPassword} />
    </>
  );
}
