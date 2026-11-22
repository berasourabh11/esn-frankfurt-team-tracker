import { describe, expect, it } from "vitest";

import { EventFormSchema, webLinkSchema } from "./event";

describe("webLinkSchema", () => {
  const link = webLinkSchema();
  it.each(["https://docs.example.org/quiz", "http://pretix.eu/esn/123", " https://esn.org "])(
    "accepts %s",
    (url) => expect(link.safeParse(url).success).toBe(true),
  );
  it.each(["https://not a url", "ftp://files.example.org", "https://localhost", "example.org", ""])(
    "rejects %s",
    (url) => expect(link.safeParse(url).success).toBe(false),
  );
});

describe("EventFormSchema", () => {
  const base = {
    title: "Pub Quiz",
    summary: "Teams, questions and prizes.",
    category: "social",
    status: "scheduled",
    startDate: "2026-12-10",
  };
  it("accepts a minimal event", () => {
    expect(EventFormSchema.safeParse(base).success).toBe(true);
  });
  it("rejects end dates before the start and end times without a start", () => {
    const result = EventFormSchema.safeParse({ ...base, endDate: "2026-12-09", endTime: "22:00" });
    expect(result.success).toBe(false);
    const paths = result.error!.issues.map((i) => i.path[0]);
    expect(paths).toEqual(expect.arrayContaining(["endDate", "startTime"]));
  });
});
