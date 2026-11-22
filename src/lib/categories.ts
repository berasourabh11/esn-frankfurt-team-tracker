import type { EventCategory } from "@/types/event";

export interface CategoryMeta {
  id: EventCategory;
  label: string;
  shortLabel: string;
  /** Solid brand colour used for chips, dots and accents. */
  color: string;
  /** Readable foreground for text on light surfaces. */
  textColor: string;
  /** Very light tint for backgrounds. */
  tint: string;
}

/**
 * Category colours are derived from the ESN brand palette
 * (cyan, magenta, green, orange, dark blue) plus two neutrals.
 */
export const CATEGORY_META: Record<EventCategory, CategoryMeta> = {
  social: {
    id: "social",
    label: "Social Events",
    shortLabel: "Social",
    color: "#00AEEF",
    textColor: "#006A94",
    tint: "#E6F7FD",
  },
  parties: {
    id: "parties",
    label: "Parties & Nightlife",
    shortLabel: "Parties",
    color: "#EC008C",
    textColor: "#A8005F",
    tint: "#FDE6F3",
  },
  trips: {
    id: "trips",
    label: "Trips & Travel",
    shortLabel: "Trips",
    color: "#2E3192",
    textColor: "#2E3192",
    tint: "#EAEBF6",
  },
  sports: {
    id: "sports",
    label: "Sports & Activities",
    shortLabel: "Sports",
    color: "#7AC143",
    textColor: "#3D6B18",
    tint: "#F0F8E9",
  },
  cultural: {
    id: "cultural",
    label: "Cultural Events",
    shortLabel: "Culture",
    color: "#F47B20",
    textColor: "#A84A05",
    tint: "#FEF1E7",
  },
  workshops: {
    id: "workshops",
    label: "Workshops & Learning",
    shortLabel: "Workshops",
    color: "#7C5CDB",
    textColor: "#5B3BB8",
    tint: "#F1EDFB",
  },
  other: {
    id: "other",
    label: "Other",
    shortLabel: "Other",
    color: "#64748B",
    textColor: "#475569",
    tint: "#F1F5F9",
  },
};

export const CATEGORY_LIST = Object.values(CATEGORY_META);

export function getCategoryMeta(category: EventCategory): CategoryMeta {
  return CATEGORY_META[category];
}
