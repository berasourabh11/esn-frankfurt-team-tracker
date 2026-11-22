"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { canManageMembers } from "@/features/auth/permissions";
import { useSession } from "@/features/auth/session";

import { isNavItemActive, NAV_ITEMS } from "./navItems";

function useNavItems() {
  const { member } = useSession();
  return NAV_ITEMS.filter(
    (item) => (!item.membersOnly || member) && (!item.moderatorsOnly || canManageMembers(member)),
  );
}

/** Desktop navigation (segmented control). */
export function MainNav({ className }: { className?: string }) {
  const pathname = usePathname();
  const items = useNavItems();
  return (
    <nav aria-label="Main" className={className}>
      <ul className="flex items-center gap-1 rounded-full bg-secondary p-1">
        {items.map((item) => {
          const active = isNavItemActive(item, pathname);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-8 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition",
                  active
                    ? "bg-card text-primary shadow-sm"
                    : "text-secondary-foreground/70 hover:text-secondary-foreground",
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Mobile bottom tab bar — app-like navigation within thumb reach. */
export function MobileTabBar() {
  const pathname = usePathname();
  const items = useNavItems();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul
        className={cn(
          "mx-auto grid max-w-md",
          items.length === 4 ? "grid-cols-4" : items.length === 3 ? "grid-cols-3" : "grid-cols-2",
        )}
      >
        {items.map((item) => {
          const active = isNavItemActive(item, pathname);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-xs font-semibold transition",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-14 items-center justify-center rounded-full transition",
                    active && "bg-accent",
                  )}
                >
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
