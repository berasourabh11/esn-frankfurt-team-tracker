import Link from "next/link";

import { cn } from "@/lib/utils";

/** ESN Frankfurt wordmark with a simple star mark (placeholder for the official logo asset). */
export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn("group flex items-center gap-2.5 rounded-xl outline-none", className)}
      aria-label="ESN Frankfurt Events — home"
    >
      <span className="relative flex size-9 items-center justify-center overflow-hidden rounded-xl bg-brand-blue shadow-sm transition group-hover:rotate-[-6deg]">
        <span className="absolute inset-0 bg-[conic-gradient(from_200deg,var(--brand-cyan),var(--brand-magenta),var(--brand-orange),var(--brand-green),var(--brand-cyan))] opacity-90" />
        <svg viewBox="0 0 100 100" className="relative size-5 fill-white" aria-hidden="true">
          <path d="M50 4l9.5 29.2H90L65.2 51.3l9.5 29.2L50 62.4 25.3 80.5l9.5-29.2L10 33.2h30.5z" />
        </svg>
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-[0.95rem] font-extrabold tracking-tight text-brand-blue">
          ESN Frankfurt
        </span>
        <span className="text-[0.7rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
          Events
        </span>
      </span>
    </Link>
  );
}
