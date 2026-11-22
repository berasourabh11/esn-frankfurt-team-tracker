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
const slugSchema = z
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
