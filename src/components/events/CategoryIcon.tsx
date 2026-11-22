import {
  Dumbbell,
  GraduationCap,
  Landmark,
  PartyPopper,
  Sparkles,
  TrainFront,
  Users,
  type LucideProps,
} from "lucide-react";

import type { EventCategory } from "@/types/event";

const ICONS: Record<EventCategory, React.ComponentType<LucideProps>> = {
  social: Users,
  parties: PartyPopper,
  trips: TrainFront,
  sports: Dumbbell,
  cultural: Landmark,
  workshops: GraduationCap,
  other: Sparkles,
};

export function CategoryIcon({ category, ...props }: { category: EventCategory } & LucideProps) {
  const Icon = ICONS[category];
  return <Icon aria-hidden="true" {...props} />;
}
