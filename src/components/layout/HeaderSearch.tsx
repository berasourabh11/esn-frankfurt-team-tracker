"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

function useSearchNavigation() {
  const router = useRouter();
  return (query: string) => {
    const q = query.trim();
    router.push(q ? `/?q=${encodeURIComponent(q)}#events` : "/#events");
  };
}

function SearchForm({
  autoFocus,
  onSubmitted,
  className,
}: {
  autoFocus?: boolean;
  onSubmitted?: () => void;
  className?: string;
}) {
  const [value, setValue] = useState("");
  const search = useSearchNavigation();

  return (
    <form
      role="search"
      className={cn("relative", className)}
      onSubmit={(e) => {
        e.preventDefault();
        search(value);
        onSubmitted?.();
      }}
    >
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search events"
        aria-label="Search events"
        autoFocus={autoFocus}
        className="bg-secondary/60 pl-10 shadow-none"
        maxLength={100}
      />
    </form>
  );
}

/** Inline search on desktop. */
export function HeaderSearch({ className }: { className?: string }) {
  return <SearchForm className={className} />;
}

/** Search button that opens a top sheet on small screens. */
export function MobileSearch() {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Search events">
          <Search className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="top" className="gap-0 pb-5">
        <SheetHeader className="pb-3">
          <SheetTitle>Search events</SheetTitle>
          <SheetDescription>Find events by name, place or topic.</SheetDescription>
        </SheetHeader>
        <div className="px-5">
          <SearchForm autoFocus onSubmitted={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
