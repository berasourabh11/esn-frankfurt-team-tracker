import { cn } from "@/lib/utils";

const PALETTE = ["#2E3192", "#00AEEF", "#EC008C", "#3D6B18", "#F47B20", "#7C5CDB", "#0F766E"];

export function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts.at(-1)![0] : "")).toUpperCase();
}

function colorFor(id: string) {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

/** Initials avatar with a stable colour per member. */
export function MemberAvatar({
  member,
  size = "md",
  className,
}: {
  member: { id: string; name: string };
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <span
      title={member.name}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white ring-2 ring-card select-none",
        size === "sm" && "size-7 text-[0.65rem]",
        size === "md" && "size-9 text-xs",
        size === "lg" && "size-12 text-sm",
        className,
      )}
      style={{ backgroundColor: colorFor(member.id) }}
    >
      <span aria-hidden="true">{getInitials(member.name)}</span>
      <span className="sr-only">{member.name}</span>
    </span>
  );
}
