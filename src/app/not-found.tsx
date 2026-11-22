import Link from "next/link";
import { CalendarX2 } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
        <CalendarX2 className="size-7" aria-hidden="true" />
      </span>
      <h1 className="text-2xl font-extrabold">We couldn&apos;t find that page</h1>
      <p className="text-muted-foreground">
        The event may have been removed or the link is incorrect.
      </p>
      <Button asChild>
        <Link href="/">See upcoming events</Link>
      </Button>
    </div>
  );
}
