import Link from "next/link";

import { Logo } from "./Logo";

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t bg-card pb-24 md:pb-0">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex flex-col gap-3">
          <Logo />
          <p className="max-w-sm text-sm text-muted-foreground">
            Events for international and exchange students in Frankfurt am Main, organised by
            volunteers of the Erasmus Student Network.
          </p>
        </div>
        <nav aria-label="Footer">
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold">
            <li>
              <Link href="/" className="hover:text-primary">
                Upcoming events
              </Link>
            </li>
            <li>
              <Link href="/calendar" className="hover:text-primary">
                Calendar
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
