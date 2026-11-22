import { getCategoryMeta } from "@/lib/categories";
import { cn } from "@/lib/utils";
import type { EventCategory } from "@/types/event";

import { CategoryIcon } from "./CategoryIcon";

export function CategoryBadge({
  category,
  short = false,
  className,
}: {
  category: EventCategory;
  short?: boolean;
  className?: string;
}) {
  const meta = getCategoryMeta(category);
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        className,
      )}
      style={{ backgroundColor: meta.tint, color: meta.textColor }}
    >
      <CategoryIcon category={category} className="size-3.5" />
      {short ? meta.shortLabel : meta.label}
    </span>
  );
}
