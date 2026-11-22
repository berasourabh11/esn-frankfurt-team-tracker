import { z } from "zod";

import { webLinkSchema } from "./event";

/**
 * Team (internal) contracts: ESN members and the shifts/tasks they take on
 * for an event. Shared with the API (backend/), which validates with the same schemas.
 */

/**
 * - admin:     everything (moderator + member)
 * - moderator: manages people (accepts registrations, sets roles, removes accounts)
 * - member:    the ESN team: events, shifts & tasks, hosts and notes
 * - user:      takes shifts, ticks off own tasks, adds review notes
 */
export const MEMBER_ROLES = ["admin", "moderator", "member", "user"] as const;
export const MemberRoleSchema = z.enum(MEMBER_ROLES);
export type MemberRole = z.infer<typeof MemberRoleSchema>;

export const MEMBER_ROLE_LABELS: Record<MemberRole, string> = {
  admin: "Admin",
  moderator: "Moderator",
  member: "Member",
  user: "User",
};

export const MEMBER_ROLE_DESCRIPTIONS: Record<MemberRole, string> = {
  admin: "Everything: people, roles, events, shifts & tasks, hosts and notes",
  moderator: "Accepts new registrations, decides roles and removes accounts",
  member: "Creates and edits events, shifts & tasks, hosts and notes",
  user: "Takes shifts, ticks off own tasks and adds review notes",
};

/** New registrations are "pending" until a moderator accepts them. */
export const ACCOUNT_STATUSES = ["pending", "active"] as const;
export const AccountStatusSchema = z.enum(ACCOUNT_STATUSES);
export type AccountStatus = z.infer<typeof AccountStatusSchema>;

export const MemberSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** Only sent to signed-in members (the public only sees event hosts' names). */
  email: z.email().optional(),
  role: MemberRoleSchema,
  /** Working group inside ESN Frankfurt, e.g. "Events", "Communication". */
  team: z.string().min(1).optional(),
  /** Missing means "active". */
  status: AccountStatusSchema.optional(),
  /** When the account was created (sent to moderators). */
  createdAt: z.string().optional(),
});
export type Member = z.infer<typeof MemberSchema>;

export const isPending = (member: Pick<Member, "status"> | null | undefined) =>
  member?.status === "pending";

/** Self-registration (API mode). New accounts wait for a moderator. */
export const RegisterSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(80),
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid e-mail address")),
  password: z.string().min(10, "Use at least 10 characters").max(200, "Use at most 200 characters"),
});
export type RegisterValues = z.infer<typeof RegisterSchema>;

export const MIN_PASSWORD_LENGTH = 10;

/** Adding/editing a member (moderators only). The password is only used with the real API. */
export const MemberFormSchema = z.object({
  name: z.string().trim().min(2, "Enter the member's name").max(80),
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid e-mail address")),
  role: MemberRoleSchema,
  team: z.string().trim().max(60).optional(),
  password: z
    .string()
    .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters`)
    .max(200)
    .optional(),
});
export type MemberFormValues = z.infer<typeof MemberFormSchema>;

export const TASK_KINDS = ["shift", "task"] as const;
export const TaskKindSchema = z.enum(TASK_KINDS);
export type TaskKind = z.infer<typeof TaskKindSchema>;

const isoDate = z.iso.date();
const wallClockTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm");

export const EventTaskSchema = z.object({
  id: z.string().min(1),
  eventSlug: z.string().min(1),
  /** A "shift" is a time slot at the event; a "task" is a to-do (preparation, follow-up). */
  kind: TaskKindSchema,
  title: z.string().min(1),
  description: z.string().default(""),
  /** Day of the shift/deadline. Defaults to the event's start date. */
  date: isoDate.optional(),
  startTime: wallClockTime.optional(),
  endTime: wallClockTime.optional(),
  location: z.string().optional(),
  peopleNeeded: z.number().int().min(1).max(50),
  assigneeIds: z.array(z.string()).default([]),
  done: z.boolean().default(false),
  createdBy: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type EventTask = z.infer<typeof EventTaskSchema>;
export type EventTaskInput = z.input<typeof EventTaskSchema>;

/** Validation for the create/edit form. */
export const TaskFormSchema = z
  .object({
    kind: TaskKindSchema,
    title: z.string().trim().min(2, "Give the task a short title").max(80),
    description: z.string().trim().max(1000, "Keep the description under 1000 characters"),
    date: isoDate.optional(),
    startTime: wallClockTime.optional(),
    endTime: wallClockTime.optional(),
    location: z.string().trim().max(120).optional(),
    peopleNeeded: z.coerce
      .number<number>({ message: "Enter a number" })
      .int("Use a whole number")
      .min(1, "At least 1 person")
      .max(50, "At most 50 people"),
  })
  .superRefine((value, ctx) => {
    if (value.kind === "shift" && !value.startTime) {
      ctx.addIssue({ code: "custom", path: ["startTime"], message: "Shifts need a start time" });
    }
    if (value.endTime && !value.startTime) {
      ctx.addIssue({ code: "custom", path: ["startTime"], message: "Add a start time too" });
    }
  });
export type TaskFormValues = z.infer<typeof TaskFormSchema>;

/** Post-event review ("retro") notes discussed in the team meeting. */
export const REVIEW_NOTE_KINDS = ["went-well", "improve"] as const;
export const ReviewNoteKindSchema = z.enum(REVIEW_NOTE_KINDS);
export type ReviewNoteKind = z.infer<typeof ReviewNoteKindSchema>;

export const REVIEW_NOTE_LABELS: Record<ReviewNoteKind, string> = {
  "went-well": "What went well",
  improve: "What could be better",
};

export const ReviewNoteSchema = z.object({
  id: z.string().min(1),
  eventSlug: z.string().min(1),
  kind: ReviewNoteKindSchema,
  text: z.string().trim().min(1).max(500),
  authorId: z.string().min(1),
  createdAt: z.string(),
});
export type ReviewNote = z.infer<typeof ReviewNoteSchema>;

export const ReviewNoteFormSchema = z.object({
  kind: ReviewNoteKindSchema,
  text: z.string().trim().min(3, "Write a few words").max(500, "Keep it under 500 characters"),
});

/** An important link for the team, e.g. a sign-up form, budget sheet or WhatsApp group. */
export const ImportantLinkSchema = z.object({
  id: z.string().min(1),
  label: z.string().trim().min(1, "Give the link a name").max(60),
  url: webLinkSchema(),
});
export type ImportantLink = z.infer<typeof ImportantLinkSchema>;

/**
 * Per-event team information: who hosts the event, internal notes and
 * important links. Hosts are shown publicly; notes and links are team-only.
 */
export const EventTeamInfoSchema = z.object({
  eventSlug: z.string().min(1),
  hostIds: z.array(z.string()).default([]),
  notes: z.string().max(4000).default(""),
  links: z.array(ImportantLinkSchema).max(20).default([]),
  updatedAt: z.string().optional(),
  updatedBy: z.string().optional(),
});
export type EventTeamInfo = z.infer<typeof EventTeamInfoSchema>;
export type EventTeamInfoPatch = Partial<Pick<EventTeamInfo, "hostIds" | "notes" | "links">>;
