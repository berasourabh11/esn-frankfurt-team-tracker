import type { Metadata } from "next";

import { TeamOverview } from "@/features/team/TeamOverview";

export const metadata: Metadata = {
  title: "Team",
  description: "Shifts, tasks and members of the ESN Frankfurt team.",
  robots: { index: false, follow: false },
};

export default function TeamPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="mb-6 flex flex-col gap-1">
        <p className="text-xs font-bold tracking-wide text-brand-magenta uppercase">ESN team</p>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Team space</h1>
        <p className="text-muted-foreground">Your shifts and tasks, and who&apos;s on the team.</p>
      </header>
      <TeamOverview />
    </div>
  );
}
