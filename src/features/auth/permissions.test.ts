import { describe, expect, it } from "vitest";

import type { EventTask, Member, ReviewNote } from "@/types/team";

import {
  canDeleteReviewNote,
  canJoin,
  canManageEvents,
  canManageMembers,
  canManageTasks,
  canToggleDone,
  isAssigned,
} from "./permissions";

const member = (id: string, role: Member["role"]): Member => ({
  id,
  name: id,
  email: `${id}@example.org`,
  role,
});
const moderator = member("mod", "moderator");
const organiser = member("org", "member");
const volunteer = member("vol", "user");
const other = member("other", "user");
const pending: Member = { ...member("new", "member"), status: "pending" };

const task = (overrides: Partial<EventTask> = {}): EventTask => ({
  id: "t",
  eventSlug: "e",
  kind: "shift",
  title: "Shift",
  description: "",
  peopleNeeded: 2,
  assigneeIds: [],
  done: false,
  ...overrides,
});

describe("permissions", () => {
  it("lets members manage tasks and events, not users, moderators or visitors", () => {
    expect(canManageTasks(organiser)).toBe(true);
    expect(canManageEvents(organiser)).toBe(true);
    expect(canManageTasks(moderator)).toBe(false);
    expect(canManageEvents(moderator)).toBe(false);
    expect(canManageTasks(volunteer)).toBe(false);
    expect(canManageTasks(null)).toBe(false);
  });

  it("lets only moderators manage people", () => {
    expect(canManageMembers(moderator)).toBe(true);
    expect(canManageMembers(organiser)).toBe(false);
    expect(canManageMembers(volunteer)).toBe(false);
  });

  it("gives pending registrations no rights, whatever their role", () => {
    expect(canManageTasks(pending)).toBe(false);
    expect(canManageMembers({ ...pending, role: "moderator" })).toBe(false);
  });

  it("lets members join open, unfinished tasks once", () => {
    expect(canJoin(volunteer, task())).toBe(true);
    expect(canJoin(null, task())).toBe(false);
    expect(canJoin(volunteer, task({ assigneeIds: ["vol"] }))).toBe(false);
    expect(canJoin(volunteer, task({ assigneeIds: ["a", "b"] }))).toBe(false);
    expect(canJoin(volunteer, task({ done: true }))).toBe(false);
    expect(isAssigned(volunteer, task({ assigneeIds: ["vol"] }))).toBe(true);
  });

  it("lets assignees and managers mark tasks done", () => {
    expect(canToggleDone(volunteer, task({ assigneeIds: ["vol"] }))).toBe(true);
    expect(canToggleDone(other, task({ assigneeIds: ["vol"] }))).toBe(false);
    expect(canToggleDone(organiser, task())).toBe(true);
  });

  it("lets authors and managers delete review notes", () => {
    const note: ReviewNote = {
      id: "n",
      eventSlug: "e",
      kind: "improve",
      text: "x",
      authorId: "vol",
      createdAt: "2026-11-20T10:00:00Z",
    };
    expect(canDeleteReviewNote(volunteer, note)).toBe(true);
    expect(canDeleteReviewNote(other, note)).toBe(false);
    expect(canDeleteReviewNote(organiser, note)).toBe(true);
  });
});
