import { getCategoryMeta } from "@/lib/categories";
import { formatDayOfMonth, formatMonthShort, formatWeekdayShort } from "@/lib/dateUtils";
import { cn } from "@/lib/utils";
import type { EventCategory } from "@/types/event";

import { CategoryIcon } from "./CategoryIcon";

/**
 * The coloured block on the left of every event card: works as both the
 * date badge and the category visual.
 */
export function DateBadge({
  date,
  category,
  className,
}: {
  date: string;
  category: EventCategory;
  className?: string;
}) {
  const meta = getCategoryMeta(category);
  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center overflow-hidden text-white",
        className,
      )}
      style={{
        backgroundImage: `linear-gradient(150deg, ${meta.color} 0%, color-mix(in oklab, ${meta.color} 70%, #0d0f3a) 100%)`,
      }}
    >
      <CategoryIcon
        category={category}
        className="absolute -right-3 -bottom-3 size-16 rotate-[-12deg] opacity-[0.18]"
        strokeWidth={1.5}
      />
      <span className="text-[0.7rem] font-semibold tracking-[0.12em] uppercase opacity-90">
        {formatWeekdayShort(date)}
      </span>
      <span className="text-3xl leading-none font-extrabold tabular-nums">
        {formatDayOfMonth(date)}
      </span>
      <span className="text-xs font-semibold tracking-wide uppercase opacity-90">
        {formatMonthShort(date)}
      </span>
    </div>
  );
}
