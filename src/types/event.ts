import { z } from "zod";

/**
 * Event contract shared by the UI and the (future) Spring Boot REST API.
 *
 * Dates are calendar dates in the Europe/Berlin timezone ("YYYY-MM-DD") and
 * times are Berlin wall-clock times ("HH:mm"). Keeping them as plain strings
 * avoids timezone drift between the JVM, the Next.js server and browsers.
 */

export const EVENT_CATEGORIES = [
  "social",
  "parties",
  "trips",
  "sports",
  "cultural",
  "workshops",
  "other",
] as const;

export const EventCategorySchema = z.enum(EVENT_CATEGORIES);
export type EventCategory = z.infer<typeof EventCategorySchema>;

export const EVENT_STATUSES = ["scheduled", "tentative", "cancelled"] as const;
export const EventStatusSchema = z.enum(EVENT_STATUSES);
export type EventStatus = z.infer<typeof EventStatusSchema>;

const isoDate = z.iso.date();
export const slugSchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be kebab-case");
const wallClockTime = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Expected a 24h time in HH:mm format");

export const EsnEventSchema = z
  .object({
    id: z.string().min(1),
    slug: slugSchema,
    /**
     * Set on sub-events: the slug of the main event they belong to (e.g. the
     * "Murder Mystery" night of the CriminaLP weekend). One level only.
     */
    parentSlug: slugSchema.optional(),
    /**
     * Set on the dates of a repeating event (e.g. the weekly Language Café):
     * the id of its series. Each date has its own page, shifts and notes.
     */
    seriesId: z.string().min(1).optional(),
    title: z.string().min(1),
    /** One or two sentences shown on cards. */
    summary: z.string().min(1),
    /** Public description shown on the details view. */
    description: z.string().min(1),
    category: EventCategorySchema,
    status: EventStatusSchema.default("scheduled"),
    startDate: isoDate,
    /** Inclusive end date for multi-day events. */
    endDate: isoDate.optional(),
    startTime: wallClockTime.optional(),
    endTime: wallClockTime.optional(),
    location: z.string().min(1).optional(),
    priceInfo: z.string().min(1).optional(),
    registrationUrl: z.url().optional(),
    imageUrl: z.url().optional(),
    tags: z.array(z.string()).default([]),
  })
  .refine((e) => !e.endDate || e.endDate >= e.startDate, {
    message: "endDate must not be before startDate",
    path: ["endDate"],
  });

export type EsnEvent = z.infer<typeof EsnEventSchema>;
/** Shape accepted before defaults are applied (e.g. raw API payloads). */
export type EsnEventInput = z.input<typeof EsnEventSchema>;

export const EsnEventListSchema = z.array(EsnEventSchema);

/**
 * A public web link: http(s), a real domain (e.g. "docs.example.org") and no
 * spaces. Browsers' URL parsers are lenient (they percent-encode spaces in
 * hostnames), so the hostname is checked explicitly.
 */
export const webLinkSchema = (message = "Enter a full link starting with https://") =>
  z
    .string()
    .trim()
    .refine((v) => !/\s/.test(v), message)
    .pipe(
      z.url({
        protocol: /^https?$/,
        hostname: /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i,
        message,
      }),
    );

/** Validation for the create/edit event form (team area). */
export const EventFormSchema = z
  .object({
    title: z.string().trim().min(3, "Give the event a title").max(100),
    summary: z.string().trim().min(10, "Write a short summary (at least 10 characters)").max(200),
    description: z.string().trim().max(4000).optional(),
    category: EventCategorySchema,
    status: EventStatusSchema,
    startDate: z.iso.date({ message: "Pick a date" }),
    endDate: z.iso.date().optional(),
    startTime: wallClockTime.optional(),
    endTime: wallClockTime.optional(),
    location: z.string().trim().max(120).optional(),
    priceInfo: z.string().trim().max(80).optional(),
    registrationUrl: webLinkSchema().optional(),
    /** The main event this one is part of; leave out for stand-alone events. */
    parentSlug: slugSchema.optional(),
  })
  .superRefine((v, ctx) => {
    if (v.endDate && v.endDate < v.startDate) {
      ctx.addIssue({ code: "custom", path: ["endDate"], message: "Ends before it starts" });
    }
    if (v.endTime && !v.startTime) {
      ctx.addIssue({ code: "custom", path: ["startTime"], message: "Add a start time too" });
    }
  });
export type EventFormValues = z.infer<typeof EventFormSchema>;

/** Upper limit of dates a repeating event can produce (5 years of weekly dates). */
export const MAX_SERIES_OCCURRENCES = 260;

/**
 * How an event repeats. The weekday / day of the month comes from the first
 * date, e.g. a weekly series starting on a Wednesday repeats on Wednesdays.
 */
export const RecurrenceSchema = z
  .object({
    frequency: z.enum(["weekly", "monthly"]),
    /** Every N weeks / months. */
    interval: z.number().int().min(1).max(12),
    /** Monthly only: the same weekday ("first Wednesday") or the same day ("the 15th"). */
    monthlyBy: z.enum(["weekday", "day"]).optional(),
    /** Last possible date (inclusive). */
    until: isoDate.optional(),
    /** Number of dates. Leave out both `until` and `count` to repeat without an end. */
    count: z
      .number({ message: "Enter how many times" })
      .int("Enter a whole number")
      .min(2, "At least 2 dates")
      .max(MAX_SERIES_OCCURRENCES, `At most ${MAX_SERIES_OCCURRENCES} dates`)
      .optional(),
  })
  .refine((r) => !(r.until && r.count), { message: "Pick an end date or a number of dates" });
export type Recurrence = z.infer<typeof RecurrenceSchema>;

/** A repeating event: one template plus its rule; the dates are generated from it. */
export const EventSeriesSchema = z.object({
  id: z.string().min(1),
  /** Each date's slug is "{slug}-{YYYY-MM-DD}". */
  slug: slugSchema,
  title: z.string().min(1),
  summary: z.string().min(1),
  description: z.string().min(1),
  category: EventCategorySchema,
  status: EventStatusSchema.default("scheduled"),
  /** The first date. */
  startDate: isoDate,
  /** End of the first date, for multi-day events (later dates keep the same length). */
  endDate: isoDate.optional(),
  startTime: wallClockTime.optional(),
  endTime: wallClockTime.optional(),
  location: z.string().min(1).optional(),
  priceInfo: z.string().min(1).optional(),
  registrationUrl: z.url().optional(),
  recurrence: RecurrenceSchema,
  /** Dates that were removed from the series. */
  excludedDates: z.array(isoDate).default([]),
  /** Default hosts of every date. */
  hostIds: z.array(z.string()).default([]),
});
export type EventSeries = z.infer<typeof EventSeriesSchema>;

/** Creating or editing a whole repeating event. */
export const SeriesFormSchema = z
  .object({
    event: EventFormSchema,
    recurrence: RecurrenceSchema,
    hostIds: z.array(z.string().min(1)).max(30).default([]),
  })
  .superRefine((v, ctx) => {
    if (v.event.parentSlug) {
      ctx.addIssue({
        code: "custom",
        path: ["event", "parentSlug"],
        message: "A repeating event can't be part of another event.",
      });
    }
    if (v.recurrence.until && v.recurrence.until < v.event.startDate) {
      ctx.addIssue({
        code: "custom",
        path: ["recurrence", "until"],
        message: "The last date is before the first one",
      });
    }
  });
export type SeriesFormValues = z.infer<typeof SeriesFormSchema>;
