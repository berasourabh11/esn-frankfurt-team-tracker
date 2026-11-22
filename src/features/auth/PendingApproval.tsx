"use client";

import { useState } from "react";
import { Hourglass, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Member } from "@/types/team";

import { useRefreshSession, useSession } from "./session";

/** Shown to people whose registration is waiting for a moderator. */
export function PendingApproval({ account, className }: { account: Member; className?: string }) {
  const refresh = useRefreshSession();
  const { signOut } = useSession();
  const [checking, setChecking] = useState(false);

  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100",
        className,
      )}
    >
      <p className="flex items-center gap-2 font-bold">
        <Hourglass className="size-4" aria-hidden="true" />
        Waiting for approval
      </p>
      <p className="text-sm opacity-80">
        Thanks for registering, {account.name.split(" ")[0]}! A moderator will check your account
        and decide your role. You&apos;ll get access to shifts, tasks and the team area once
        you&apos;re accepted.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={checking}
          onClick={async () => {
            setChecking(true);
            try {
              await refresh();
            } finally {
              setChecking(false);
            }
          }}
        >
          <RefreshCw className={cn(checking && "animate-spin")} />
          Check again
        </Button>
        <Button size="sm" variant="ghost" onClick={() => void signOut()}>
          Sign out
        </Button>
      </div>
    </div>
  );
}
