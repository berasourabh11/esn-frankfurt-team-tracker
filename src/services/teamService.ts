import { mockEventTasks } from "@/mocks/eventTasks";
import { mockEventTeamInfo } from "@/mocks/eventTeamInfo";
import { mockMembers } from "@/mocks/members";
import { mockReviewNotes } from "@/mocks/reviewNotes";
import { ApiError, apiRequest } from "@/lib/api";
import {
  EventTeamInfoSchema,
  EventTaskSchema,
  MemberSchema,
  ReviewNoteSchema,
  type EventTask,
  type EventTeamInfo,
  type EventTeamInfoPatch,
  type Member,
  type MemberFormValues,
  type MemberRole,
  type ReviewNote,
  type ReviewNoteKind,
  type TaskFormValues,
} from "@/types/team";

/**
 * Data-access boundary for internal team data (members, shifts, tasks).
 *
 * Today: `createLocalTeamService` keeps data in the browser (localStorage),
 * seeded with mock data — good enough for demos and UX testing.
 * With the API: `createHttpTeamService`, and the API enforces permissions
 * (the UI checks are only for convenience).
 *
 * API endpoints (implemented by the Cloudflare Worker in /backend):
 *   GET    /api/members
 *   POST   /api/members                   (moderators)
 *   POST   /api/members/{id}/approve      (moderators) { role }
 *   PATCH  /api/members/{id}              (moderators; everyone: own name/team)
 *   DELETE /api/members/{id}              (moderators; also rejects a registration)
 *   GET    /api/events/{slug}/tasks
 *   GET    /api/members/{id}/tasks
 *   POST   /api/events/{slug}/tasks
 *   PATCH  /api/tasks/{id}
 *   DELETE /api/tasks/{id}
 *   PUT    /api/tasks/{id}/assignees/{memberId}
 *   DELETE /api/tasks/{id}/assignees/{memberId}
 *   GET    /api/events/{slug}/reviews
 *   POST   /api/events/{slug}/reviews
 *   DELETE /api/reviews/{id}
 *   GET    /api/events/team-info          (hosts, notes, links for all events)
 *   PUT    /api/events/{slug}/team-info
 */
export interface TeamService {
  listMembers(): Promise<Member[]>;
  /** Moderators only (enforced by the API). */
  createMember(values: MemberFormValues): Promise<Member>;
  updateMember(memberId: string, patch: Partial<MemberFormValues>): Promise<Member>;
  /** Accepts a pending registration with the given role. */
  approveMember(memberId: string, role: MemberRole): Promise<Member>;
  deleteMember(memberId: string): Promise<void>;
  listEventTasks(eventSlug: string): Promise<EventTask[]>;
  listMemberTasks(memberId: string): Promise<EventTask[]>;
  createTask(eventSlug: string, values: TaskFormValues, createdBy?: string): Promise<EventTask>;
  updateTask(
    taskId: string,
    patch: Partial<TaskFormValues> & { done?: boolean },
  ): Promise<EventTask>;
  deleteTask(taskId: string): Promise<void>;
  assign(taskId: string, memberId: string): Promise<EventTask>;
  unassign(taskId: string, memberId: string): Promise<EventTask>;
  /** Post-event review notes ("what went well" / "what could be better"). */
  listReviewNotes(eventSlug: string): Promise<ReviewNote[]>;
  addReviewNote(
    eventSlug: string,
    note: { kind: ReviewNoteKind; text: string },
    authorId: string,
  ): Promise<ReviewNote>;
  deleteReviewNote(noteId: string): Promise<void>;
  /** Hosts, internal notes and important links per event. */
  listEventInfos(): Promise<EventTeamInfo[]>;
  updateEventInfo(
    eventSlug: string,
    patch: EventTeamInfoPatch,
    updatedBy?: string,
  ): Promise<EventTeamInfo>;
}

export function emptyEventInfo(eventSlug: string): EventTeamInfo {
  return { eventSlug, hostIds: [], notes: "", links: [] };
}

export class TeamServiceError extends Error {
  constructor(
    message: string,
    readonly code: "not-found" | "full" | "invalid" | "http" = "invalid",
  ) {
    super(message);
    this.name = "TeamServiceError";
  }
}

// ─── Helpers shared by all implementations ──────────────────────────────────

export function openSpots(task: Pick<EventTask, "peopleNeeded" | "assigneeIds">) {
  return Math.max(0, task.peopleNeeded - task.assigneeIds.length);
}

export function isFull(task: Pick<EventTask, "peopleNeeded" | "assigneeIds">) {
  return openSpots(task) === 0;
}

/** Shifts first in chronological order, then tasks; done items last. */
export function sortTasks(tasks: readonly EventTask[]): EventTask[] {
  return [...tasks].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (a.kind !== b.kind) return a.kind === "shift" ? -1 : 1;
    const ak = `${a.date ?? ""}T${a.startTime ?? "99:99"}`;
    const bk = `${b.date ?? ""}T${b.startTime ?? "99:99"}`;
    if (ak !== bk) return ak < bk ? -1 : 1;
    return a.title.localeCompare(b.title);
  });
}

export interface StaffingSummary {
  total: number;
  filledSpots: number;
  neededSpots: number;
  openTasks: number;
  done: number;
}

export function summariseStaffing(tasks: readonly EventTask[]): StaffingSummary {
  let filledSpots = 0;
  let neededSpots = 0;
  let openTasks = 0;
  let done = 0;
  for (const task of tasks) {
    if (task.done) {
      done += 1;
      continue;
    }
    filledSpots += Math.min(task.assigneeIds.length, task.peopleNeeded);
    neededSpots += task.peopleNeeded;
    if (!isFull(task)) openTasks += 1;
  }
  return { total: tasks.length, filledSpots, neededSpots, openTasks, done };
}

/** Removes empty optional fields coming from forms. */
function cleanValues<T extends Partial<TaskFormValues>>(values: T): T {
  const out = { ...values };
  for (const key of ["date", "startTime", "endTime", "location"] as const) {
    if (key in out && !out[key]) out[key] = undefined;
  }
  return out;
}

// ─── Local (browser) implementation ─────────────────────────────────────────

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const TEAM_STORAGE_KEY = "esn-frankfurt:team-tasks:v1";
export const REVIEW_STORAGE_KEY = "esn-frankfurt:review-notes:v1";
export const EVENT_INFO_STORAGE_KEY = "esn-frankfurt:event-team-info:v1";
// v2: roles changed to moderator/member/user.
export const MEMBERS_STORAGE_KEY = "esn-frankfurt:members:v2";

function createMemoryStorage(): KeyValueStorage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
  };
}

export function createLocalTeamService({
  storage = typeof window !== "undefined" ? window.localStorage : createMemoryStorage(),
  members = mockMembers,
  seedTasks = mockEventTasks,
  seedReviewNotes = mockReviewNotes,
  seedEventInfos = mockEventTeamInfo,
  now = () => new Date(),
  generateId = () => `t-${Math.random().toString(36).slice(2, 10)}`,
}: {
  storage?: KeyValueStorage;
  members?: Member[];
  seedTasks?: unknown[];
  seedReviewNotes?: unknown[];
  seedEventInfos?: unknown[];
  now?: () => Date;
  generateId?: () => string;
} = {}): TeamService {
  const seedMembers = members.map((m) => MemberSchema.parse(m));

  /** Reads a validated list from storage, falling back to seed data. */
  function readList<T>(
    key: string,
    seed: unknown[],
    schema: { safeParse(v: unknown): { success: true; data: T } | { success: false } },
  ): T[] {
    let raw: string | null = null;
    try {
      raw = storage.getItem(key);
    } catch {
      // Storage can be unavailable (private mode); fall back to seed data.
    }
    const parsed: unknown = raw ? safeJson(raw) : null;
    const source = Array.isArray(parsed) ? parsed : seed;
    return source.flatMap((item) => {
      const result = schema.safeParse(item);
      return result.success ? [result.data] : [];
    });
  }

  function writeList(key: string, items: unknown[]) {
    try {
      storage.setItem(key, JSON.stringify(items));
    } catch {
      // Ignore quota/availability errors; the UI keeps working for this session.
    }
  }

  const read = () => readList<EventTask>(TEAM_STORAGE_KEY, seedTasks, EventTaskSchema);
  const write = (tasks: EventTask[]) => writeList(TEAM_STORAGE_KEY, tasks);
  const readInfos = () =>
    readList<EventTeamInfo>(EVENT_INFO_STORAGE_KEY, seedEventInfos, EventTeamInfoSchema);
  const readNotes = () =>
    readList<ReviewNote>(REVIEW_STORAGE_KEY, seedReviewNotes, ReviewNoteSchema);
  const readMembers = () => readList<Member>(MEMBERS_STORAGE_KEY, seedMembers, MemberSchema);

  function checkEmailFree(list: Member[], email: string, exceptId?: string) {
    if (list.some((m) => m.id !== exceptId && m.email?.toLowerCase() === email.toLowerCase())) {
      throw new TeamServiceError("That e-mail is already used by another member.", "invalid");
    }
  }

  function checkNotLastModerator(list: Member[], member: Member) {
    const canModerate = (m: Member) =>
      (m.role === "moderator" || m.role === "admin") && m.status !== "pending";
    if (canModerate(member) && list.filter(canModerate).length <= 1) {
      throw new TeamServiceError("There must always be at least one moderator.", "invalid");
    }
  }

  function mutate(taskId: string, change: (task: EventTask) => EventTask): EventTask {
    const tasks = read();
    const index = tasks.findIndex((t) => t.id === taskId);
    if (index === -1) throw new TeamServiceError("This task no longer exists.", "not-found");
    const updated = EventTaskSchema.parse({
      ...change(tasks[index]),
      updatedAt: now().toISOString(),
    });
    tasks[index] = updated;
    write(tasks);
    return updated;
  }

  return {
    async listMembers() {
      return readMembers().sort((a, b) => a.name.localeCompare(b.name));
    },
    // Demo mode has no passwords: the password field is ignored here.
    async createMember({ password: _password, ...values }) {
      void _password;
      const list = readMembers();
      checkEmailFree(list, values.email);
      const member = MemberSchema.parse({
        ...values,
        team: values.team || undefined,
        id: generateId().replace(/^t-/, "m-"),
        status: "active",
        createdAt: now().toISOString(),
      });
      writeList(MEMBERS_STORAGE_KEY, [...list, member]);
      return member;
    },
    async updateMember(memberId, { password: _password, ...patch }) {
      void _password;
      const list = readMembers();
      const current = list.find((m) => m.id === memberId);
      if (!current) throw new TeamServiceError("This member no longer exists.", "not-found");
      if (patch.email) checkEmailFree(list, patch.email, memberId);
      if (patch.role && patch.role !== "moderator" && patch.role !== "admin") {
        checkNotLastModerator(list, current);
      }
      const next = MemberSchema.parse({
        ...current,
        ...patch,
        team: "team" in patch ? patch.team || undefined : current.team,
      });
      writeList(
        MEMBERS_STORAGE_KEY,
        list.map((m) => (m.id === memberId ? next : m)),
      );
      return next;
    },
    async approveMember(memberId, role) {
      const list = readMembers();
      const current = list.find((m) => m.id === memberId);
      if (!current)
        throw new TeamServiceError("This person no longer has an account.", "not-found");
      const next = MemberSchema.parse({ ...current, role, status: "active" });
      writeList(
        MEMBERS_STORAGE_KEY,
        list.map((m) => (m.id === memberId ? next : m)),
      );
      return next;
    },
    async deleteMember(memberId) {
      const list = readMembers();
      const current = list.find((m) => m.id === memberId);
      if (!current) throw new TeamServiceError("This member no longer exists.", "not-found");
      checkNotLastModerator(list, current);
      writeList(
        MEMBERS_STORAGE_KEY,
        list.filter((m) => m.id !== memberId),
      );
      // Like the API: assignments and hosting go with the member.
      write(
        read().map((t) => ({ ...t, assigneeIds: t.assigneeIds.filter((id) => id !== memberId) })),
      );
      writeList(
        EVENT_INFO_STORAGE_KEY,
        readInfos().map((i) => ({ ...i, hostIds: i.hostIds.filter((id) => id !== memberId) })),
      );
    },
    async listEventTasks(eventSlug) {
      return sortTasks(read().filter((t) => t.eventSlug === eventSlug));
    },
    async listMemberTasks(memberId) {
      return sortTasks(read().filter((t) => t.assigneeIds.includes(memberId)));
    },
    async createTask(eventSlug, values, createdBy) {
      const timestamp = now().toISOString();
      const task = EventTaskSchema.parse({
        ...cleanValues(values),
        id: generateId(),
        eventSlug,
        assigneeIds: [],
        done: false,
        createdBy,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      write([...read(), task]);
      return task;
    },
    async updateTask(taskId, patch) {
      return mutate(taskId, (task) => {
        const next = { ...task, ...cleanValues(patch) };
        // Shrinking a task never drops people silently.
        if (next.peopleNeeded < next.assigneeIds.length) {
          throw new TeamServiceError(
            `${next.assigneeIds.length} people are already assigned. Remove someone first.`,
            "invalid",
          );
        }
        return next;
      });
    },
    async deleteTask(taskId) {
      const tasks = read();
      if (!tasks.some((t) => t.id === taskId)) {
        throw new TeamServiceError("This task no longer exists.", "not-found");
      }
      write(tasks.filter((t) => t.id !== taskId));
    },
    async assign(taskId, memberId) {
      if (!readMembers().some((m) => m.id === memberId)) {
        throw new TeamServiceError("Unknown member.", "not-found");
      }
      return mutate(taskId, (task) => {
        if (task.assigneeIds.includes(memberId)) return task;
        if (isFull(task)) throw new TeamServiceError("All spots are already taken.", "full");
        return { ...task, assigneeIds: [...task.assigneeIds, memberId] };
      });
    },
    async unassign(taskId, memberId) {
      return mutate(taskId, (task) => ({
        ...task,
        assigneeIds: task.assigneeIds.filter((id) => id !== memberId),
      }));
    },
    async listReviewNotes(eventSlug) {
      return readNotes()
        .filter((n) => n.eventSlug === eventSlug)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },
    async addReviewNote(eventSlug, note, authorId) {
      const created = ReviewNoteSchema.parse({
        ...note,
        id: generateId().replace(/^t-/, "r-"),
        eventSlug,
        authorId,
        createdAt: now().toISOString(),
      });
      writeList(REVIEW_STORAGE_KEY, [...readNotes(), created]);
      return created;
    },
    async listEventInfos() {
      return readInfos();
    },
    async updateEventInfo(eventSlug, patch, updatedBy) {
      const infos = readInfos();
      const current = infos.find((i) => i.eventSlug === eventSlug) ?? emptyEventInfo(eventSlug);
      const validIds = new Set(readMembers().map((m) => m.id));
      const next = EventTeamInfoSchema.parse({
        ...current,
        ...patch,
        hostIds: [...new Set(patch.hostIds ?? current.hostIds)].filter((id) => validIds.has(id)),
        updatedAt: now().toISOString(),
        updatedBy,
      });
      writeList(EVENT_INFO_STORAGE_KEY, [...infos.filter((i) => i.eventSlug !== eventSlug), next]);
      return next;
    },
    async deleteReviewNote(noteId) {
      writeList(
        REVIEW_STORAGE_KEY,
        readNotes().filter((n) => n.id !== noteId),
      );
    },
  };
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ─── HTTP implementation (ESN Frankfurt API, /backend) ──────────────────────

export function createHttpTeamService({
  baseUrl,
  fetchImpl,
}: {
  baseUrl: string;
  fetchImpl?: typeof fetch;
}): TeamService {
  /** Sends a request; API errors become TeamServiceErrors with the API's message. */
  async function call<T>(
    path: string,
    init: { method?: string; body?: unknown; nullForUndefined?: boolean } = {},
    parse?: (data: unknown) => T,
  ): Promise<T> {
    try {
      const data = await apiRequest(baseUrl, path, { ...init, fetchImpl });
      return (parse ? parse(data) : undefined) as T;
    } catch (error) {
      if (error instanceof ApiError) {
        const code =
          error.status === 404
            ? "not-found"
            : error.status === 409 && /spots/.test(error.message)
              ? "full"
              : error.status === 400 || error.status === 409
                ? "invalid"
                : "http";
        throw new TeamServiceError(error.message, code);
      }
      throw error;
    }
  }

  const enc = encodeURIComponent;
  const member = (d: unknown) => MemberSchema.parse(d);
  const task = (d: unknown) => EventTaskSchema.parse(d);
  const note = (d: unknown) => ReviewNoteSchema.parse(d);
  const tasks = (d: unknown) => sortTasks(EventTaskSchema.array().parse(d));

  return {
    listMembers: () => call("/api/members", {}, (d) => MemberSchema.array().parse(d)),
    createMember: (values) =>
      call(
        "/api/members",
        { method: "POST", body: { ...values, team: values.team || null } },
        member,
      ),
    updateMember: (id, patch) =>
      call(
        `/api/members/${enc(id)}`,
        {
          method: "PATCH",
          body: { ...patch, ...("team" in patch ? { team: patch.team || null } : {}) },
        },
        member,
      ),
    approveMember: (id, role) =>
      call(`/api/members/${enc(id)}/approve`, { method: "POST", body: { role } }, member),
    deleteMember: (id) => call(`/api/members/${enc(id)}`, { method: "DELETE" }),
    listEventTasks: (slug) => call(`/api/events/${enc(slug)}/tasks`, {}, tasks),
    listMemberTasks: (id) => call(`/api/members/${enc(id)}/tasks`, {}, tasks),
    // The API takes the creator/author/editor from the signed-in session.
    createTask: (slug, values) =>
      call(`/api/events/${enc(slug)}/tasks`, { method: "POST", body: cleanValues(values) }, task),
    // Cleared optional fields are sent as null so the API removes them.
    updateTask: (id, patch) =>
      call(
        `/api/tasks/${enc(id)}`,
        { method: "PATCH", body: cleanValues(patch), nullForUndefined: true },
        task,
      ),
    deleteTask: (id) => call(`/api/tasks/${enc(id)}`, { method: "DELETE" }),
    assign: (id, memberId) =>
      call(`/api/tasks/${enc(id)}/assignees/${enc(memberId)}`, { method: "PUT" }, task),
    unassign: (id, memberId) =>
      call(`/api/tasks/${enc(id)}/assignees/${enc(memberId)}`, { method: "DELETE" }, task),
    listReviewNotes: (slug) =>
      call(`/api/events/${enc(slug)}/reviews`, {}, (d) => ReviewNoteSchema.array().parse(d)),
    addReviewNote: (slug, values) =>
      call(`/api/events/${enc(slug)}/reviews`, { method: "POST", body: values }, note),
    deleteReviewNote: (id) => call(`/api/reviews/${enc(id)}`, { method: "DELETE" }),
    listEventInfos: () =>
      call("/api/events/team-info", {}, (d) => EventTeamInfoSchema.array().parse(d)),
    updateEventInfo: (slug, patch) =>
      call(`/api/events/${enc(slug)}/team-info`, { method: "PUT", body: patch }, (d) =>
        EventTeamInfoSchema.parse(d),
      ),
  };
}
