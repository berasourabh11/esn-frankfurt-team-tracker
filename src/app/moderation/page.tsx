import type { Metadata } from "next";

import { ModerationPanel } from "@/features/moderation/ModerationPanel";

export const metadata: Metadata = {
  title: "Moderation",
  description: "Accept new registrations and decide roles.",
  robots: { index: false, follow: false },
};

export default function ModerationPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="mb-6 flex flex-col gap-1">
        <p className="text-xs font-bold tracking-wide text-brand-magenta uppercase">Moderators</p>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Moderation</h1>
        <p className="text-muted-foreground">
          Accept people who registered, and decide who is a moderator, member or user.
        </p>
      </header>
      <ModerationPanel />
    </div>
  );
}
