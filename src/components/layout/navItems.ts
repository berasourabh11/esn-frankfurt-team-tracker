import { CalendarDays, ShieldCheck, Sparkles, UsersRound, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: "/" | "/calendar" | "/team" | "/moderation";
  label: string;
  icon: LucideIcon;
  /** Only shown to signed-in team members. */
  membersOnly?: boolean;
  /** Only shown to moderators. */
  moderatorsOnly?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Upcoming", icon: Sparkles },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/team", label: "Team", icon: UsersRound, membersOnly: true },
  { href: "/moderation", label: "Moderation", icon: ShieldCheck, moderatorsOnly: true },
];

export function isNavItemActive(item: NavItem, pathname: string) {
  return item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
}
