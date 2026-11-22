import { describe, expect, it } from "vitest";

import { mockEvents } from "@/mocks/events";
import { mockEventTasks } from "@/mocks/eventTasks";
import { mockMembers } from "@/mocks/members";
import { mockReviewNotes } from "@/mocks/reviewNotes";
import type { EventTask } from "@/types/team";

import {
  createHttpTeamService,
  createLocalTeamService,
  sortTasks,
  summariseStaffing,
  TEAM_STORAGE_KEY,
  type KeyValueStorage,
} from "./teamService";

function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

let seq = 0;
function setup(seedTasks: unknown[] = mockEventTasks) {
  const storage = memoryStorage();
  const service = createLocalTeamService({
    storage,
    seedTasks,
    now: () => new Date("2026-11-20T12:00:00Z"),
    generateId: () => `t-new-${++seq}`,
  });
  return { storage, service };
}

const shift = {
  kind: "shift" as const,
  title: "Welcome desk",
  description: "Check the list",
  startTime: "18:00",
  endTime: "19:00",
  peopleNeeded: 2,
};

describe("seed data", () => {
  it("only references existing events and members", () => {
    const slugs = new Set(mockEvents.map((e) => e.slug));
    const memberIds = new Set(mockMembers.map((m) => m.id));
    for (const task of mockEventTasks) {
      expect(slugs.has(task.eventSlug), task.eventSlug).toBe(true);
      for (const id of task.assigneeIds ?? []) expect(memberIds.has(id), id).toBe(true);
    }
    for (const note of mockReviewNotes) {
      expect(slugs.has(note.eventSlug), note.eventSlug).toBe(true);
      expect(memberIds.has(note.authorId)).toBe(true);
    }
  });
});

describe("local team service", () => {
  it("creates tasks, persists them and lists them per event", async () => {
    const { service, storage } = setup([]);
    const created = await service.createTask(
      "ice-skating-2026-11-26",
      { ...shift, location: "" },
      "m-aisha",
    );
    expect(created).toMatchObject({
      title: "Welcome desk",
      assigneeIds: [],
      done: false,
      createdBy: "m-aisha",
    });
    expect(created.location).toBeUndefined();
    expect(JSON.parse(storage.data.get(TEAM_STORAGE_KEY)!)).toHaveLength(1);
    expect(await service.listEventTasks("ice-skating-2026-11-26")).toHaveLength(1);
    expect(await service.listEventTasks("other-event")).toHaveLength(0);
  });

  it("assigns up to the number of people needed", async () => {
    const { service } = setup([]);
    const task = await service.createTask("ice-skating-2026-11-26", shift);
    await service.assign(task.id, "m-lucas");
    await service.assign(task.id, "m-lucas"); // idempotent
    const full = await service.assign(task.id, "m-elif");
    expect(full.assigneeIds).toEqual(["m-lucas", "m-elif"]);
    await expect(service.assign(task.id, "m-noah")).rejects.toMatchObject({ code: "full" });
    await expect(service.assign(task.id, "nobody")).rejects.toMatchObject({ code: "not-found" });

    const after = await service.unassign(task.id, "m-lucas");
    expect(after.assigneeIds).toEqual(["m-elif"]);
    expect(await service.listMemberTasks("m-elif")).toHaveLength(1);
  });

  it("refuses to shrink a task below the people already assigned", async () => {
    const { service } = setup([]);
    const task = await service.createTask("ice-skating-2026-11-26", shift);
    await service.assign(task.id, "m-lucas");
    await service.assign(task.id, "m-elif");
    await expect(service.updateTask(task.id, { peopleNeeded: 1 })).rejects.toThrow(
      /already assigned/,
    );
    const done = await service.updateTask(task.id, { done: true });
    expect(done.done).toBe(true);
  });

  it("deletes tasks", async () => {
    const { service } = setup([]);
    const task = await service.createTask("ice-skating-2026-11-26", shift);
    await service.deleteTask(task.id);
    expect(await service.listEventTasks("ice-skating-2026-11-26")).toEqual([]);
    await expect(service.deleteTask(task.id)).rejects.toMatchObject({ code: "not-found" });
  });

  it("recovers from corrupted storage by falling back to seed data", async () => {
    const { service, storage } = setup();
    storage.data.set(TEAM_STORAGE_KEY, "{not json");
    expect((await service.listEventTasks("ice-skating-2026-11-26")).length).toBeGreaterThan(0);
  });

  it("adds, lists and deletes review notes", async () => {
    const { service } = setup([]);
    const before = await service.listReviewNotes("halloween-party-2026-10-30");
    const note = await service.addReviewNote(
      "halloween-party-2026-10-30",
      { kind: "improve", text: "  More water at the bar  " },
      "m-yuki",
    );
    expect(note.text).toBe("More water at the bar");
    const after = await service.listReviewNotes("halloween-party-2026-10-30");
    expect(after).toHaveLength(before.length + 1);
    expect(after.at(-1)?.id).toBe(note.id);
    await service.deleteReviewNote(note.id);
    expect(await service.listReviewNotes("halloween-party-2026-10-30")).toHaveLength(before.length);
  });
});

describe("event team info", () => {
  it("stores hosts, notes and links per event and drops unknown members", async () => {
    const { service } = setup([]);
    const before = await service.listEventInfos();
    expect(before.some((i) => i.eventSlug === "strasbourg-day-trip-2026-11-29")).toBe(true);

    const saved = await service.updateEventInfo(
      "pub-quiz-2026-12-10",
      {
        hostIds: ["m-aisha", "m-aisha", "ghost"],
        notes: "Reserve the back room",
        links: [{ id: "l1", label: "Questions", url: "https://docs.example.org/quiz" }],
      },
      "m-aisha",
    );
    expect(saved).toMatchObject({
      hostIds: ["m-aisha"],
      notes: "Reserve the back room",
      updatedBy: "m-aisha",
    });

    const partial = await service.updateEventInfo("pub-quiz-2026-12-10", { notes: "Updated" });
    expect(partial.hostIds).toEqual(["m-aisha"]);
    expect(partial.links).toHaveLength(1);
    expect((await service.listEventInfos()).length).toBe(before.length + 1);
  });
});

describe("helpers", () => {
  const base = { eventSlug: "e", description: "", assigneeIds: [] as string[], done: false };
  const tasks: EventTask[] = [
    { ...base, id: "a", kind: "task", title: "Book tickets", peopleNeeded: 1 },
    {
      ...base,
      id: "b",
      kind: "shift",
      title: "Late",
      startTime: "21:00",
      peopleNeeded: 2,
      assigneeIds: ["x", "y"],
    },
    {
      ...base,
      id: "c",
      kind: "shift",
      title: "Early",
      startTime: "18:00",
      peopleNeeded: 3,
      assigneeIds: ["x"],
    },
    {
      ...base,
      id: "d",
      kind: "shift",
      title: "Finished",
      startTime: "17:00",
      peopleNeeded: 1,
      done: true,
    },
  ];

  it("sorts shifts by time, then tasks, done last", () => {
    expect(sortTasks(tasks).map((t) => t.id)).toEqual(["c", "b", "a", "d"]);
  });

  it("summarises staffing, ignoring done tasks", () => {
    expect(summariseStaffing(tasks)).toEqual({
      total: 4,
      filledSpots: 3,
      neededSpots: 6,
      openTasks: 2,
      done: 1,
    });
  });
});

describe("members (local store)", () => {
  it("adds, edits and removes accounts, keeping one moderator", async () => {
    const { service } = setup();
    const created = await service.createMember({
      name: "Pia Neumann",
      email: "pia@esn-frankfurt.example",
      role: "user",
      team: "Events",
      password: "ignored-in-demo",
    });
    expect(created).toMatchObject({ name: "Pia Neumann", role: "user", status: "active" });
    expect((await service.listMembers()).map((m) => m.id)).toContain(created.id);

    await expect(
      service.createMember({
        name: "Other",
        email: "PIA@esn-frankfurt.example",
        role: "moderator",
      }),
    ).rejects.toThrow(/already used/);

    const promoted = await service.updateMember(created.id, { role: "member", team: "" });
    expect(promoted.role).toBe("member");
    expect(promoted.team).toBeUndefined();

    // Lena is the only moderator.
    await expect(service.updateMember("m-lena", { role: "user" })).rejects.toThrow(
      /at least one moderator/,
    );
    await expect(service.deleteMember("m-lena")).rejects.toThrow(/at least one moderator/);

    await service.deleteMember(created.id);
    expect((await service.listMembers()).some((m) => m.id === created.id)).toBe(false);
  });

  it("accepts pending registrations with a role", async () => {
    const { service } = setup();
    const before = await service.listMembers();
    expect(before.filter((m) => m.status === "pending").map((m) => m.id)).toEqual([
      "m-ana",
      "m-tom",
    ]);
    const ana = await service.approveMember("m-ana", "member");
    expect(ana).toMatchObject({ status: "active", role: "member" });
    const after = await service.listMembers();
    expect(after.find((m) => m.id === "m-ana")?.status).toBe("active");
  });

  it("takes removed members off shifts and hosting", async () => {
    const { service } = setup();
    const before = await service.listMemberTasks("m-lucas");
    expect(before.length).toBeGreaterThan(0);
    await service.deleteMember("m-lucas");
    expect(await service.listMemberTasks("m-lucas")).toEqual([]);
    const infos = await service.listEventInfos();
    expect(infos.some((i) => i.hostIds.includes("m-lucas"))).toBe(false);
  });
});

describe("HTTP team service", () => {
  function fakeFetch(status: number, body: unknown) {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(status === 204 ? null : JSON.stringify(body), { status });
    }) as unknown as typeof fetch;
    return { calls, fetchImpl };
  }

  it("shows the API's error message and marks full shifts", async () => {
    const { fetchImpl } = fakeFetch(409, { error: "All spots are already taken." });
    const service = createHttpTeamService({ baseUrl: "https://api.test/", fetchImpl });
    await expect(service.assign("t1", "m1")).rejects.toMatchObject({
      message: "All spots are already taken.",
      code: "full",
    });
  });

  it("sends cleared task fields as null and includes the session cookie", async () => {
    const task = {
      id: "t1",
      eventSlug: "e",
      kind: "task",
      title: "Buy plates",
      peopleNeeded: 1,
    };
    const { calls, fetchImpl } = fakeFetch(200, task);
    const service = createHttpTeamService({ baseUrl: "https://api.test", fetchImpl });
    await service.updateTask("t1", { kind: "task", startTime: "", endTime: undefined });
    expect(calls[0].url).toBe("https://api.test/api/tasks/t1");
    expect(calls[0].init.credentials).toBe("include");
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      kind: "task",
      startTime: null,
      endTime: null,
    });
  });
});
