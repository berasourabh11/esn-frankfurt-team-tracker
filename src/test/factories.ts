import { EsnEventSchema, type EsnEvent, type EsnEventInput } from "@/types/event";

let counter = 0;

/** Builds a valid event for tests, applying schema defaults. */
export function makeEvent(overrides: Partial<EsnEventInput> = {}): EsnEvent {
  counter += 1;
  const slug = overrides.slug ?? `test-event-${counter}`;
  return EsnEventSchema.parse({
    id: slug,
    slug,
    title: `Test Event ${counter}`,
    summary: "A short summary.",
    description: "A longer public description.",
    category: "social",
    startDate: "2026-11-20",
    ...overrides,
  });
}
