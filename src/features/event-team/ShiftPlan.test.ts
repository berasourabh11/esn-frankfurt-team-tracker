import { describe, expect, it } from "vitest";

import type { EventTask } from "@/types/team";

import { planShifts } from "./ShiftPlan";

const base = { eventSlug: "e", description: "", assigneeIds: [] as string[], done: false };
const shift = (id: string, startTime?: string, endTime?: string, date?: string): EventTask => ({
  ...base,
  id,
  kind: "shift",
  title: id,
  peopleNeeded: 1,
  startTime,
  endTime,
  date,
});

describe("planShifts", () => {
  it("builds an hour-aligned range per day from timed shifts only", () => {
    const days = planShifts(
      [
        shift("late", "21:30", "22:30"),
        shift("early", "17:00", "18:30"),
        shift("untimed"),
        { ...shift("todo", "10:00"), kind: "task" },
      ],
      "2026-12-08",
    );
    expect(days).toHaveLength(1);
    expect(days[0]).toMatchObject({ date: "2026-12-08", from: 17 * 60, to: 23 * 60 });
    expect(days[0].shifts.map((s) => s.task.id)).toEqual(["early", "late"]);
  });

  it("gives open-ended shifts one hour and handles shifts past midnight", () => {
    const [day] = planShifts(
      [shift("open", "20:00"), shift("night", "23:00", "01:00")],
      "2026-12-08",
    );
    expect(day.shifts.find((s) => s.task.id === "open")).toMatchObject({ start: 1200, end: 1260 });
    expect(day.shifts.find((s) => s.task.id === "night")).toMatchObject({ start: 1380, end: 1500 });
    expect(day.to).toBe(25 * 60);
  });

  it("splits multi-day events into one timeline per date", () => {
    const days = planShifts(
      [shift("sat", "10:00", "12:00", "2026-11-14"), shift("fri", "18:00", "20:00", "2026-11-13")],
      "2026-11-13",
    );
    expect(days.map((d) => d.date)).toEqual(["2026-11-13", "2026-11-14"]);
  });
});
