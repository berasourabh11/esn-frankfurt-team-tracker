import { beforeEach, describe, expect, it } from "vitest";

import { addDaysIso, getBerlinToday } from "@/lib/dateUtils";
import { EsnEventSchema } from "@/types/event";
import { EventTaskSchema, EventTeamInfoSchema, MemberSchema, ReviewNoteSchema } from "@/types/team";

import { emails, setup } from "./helpers";

let api: Awaited<ReturnType<typeof setup>>;
beforeEach(async () => {
  api = await setup();
});

describe("auth", () => {
  it("signs in with e-mail and password, then out", async () => {
    expect((await api.call("GET", "/api/auth/me")).status).toBe(401);
    const wrong = await api.call("POST", "/api/auth/login", {
      body: { email: emails.member, password: "nope-nope-nope" },
    });
    expect(wrong.status).toBe(401);
    expect(wrong.data.error).toBe("Wrong e-mail or password.");

    const login = await api.call("POST", "/api/auth/login", {
      body: { email: "AISHA@esn-frankfurt.example", password: "esn-demo-2026" },
    });
    expect(login.status).toBe(200);
    const setCookie = login.headers.get("set-cookie")!;
    expect(setCookie).toMatch(/esn_session=.+; .*HttpOnly/);
    expect(setCookie).toMatch(/Secure/);
    expect(setCookie).toMatch(/SameSite=Lax/);
    const cookie = setCookie.split(";")[0];

    const me = await api.call("GET", "/api/auth/me", { cookie });
    expect(MemberSchema.parse(me.data)).toMatchObject({ name: "Aisha Khan", role: "member" });

    expect((await api.call("POST", "/api/auth/logout", { cookie })).status).toBe(204);
    expect((await api.call("GET", "/api/auth/me", { cookie })).status).toBe(401);
  });

  it("stores only a hash of the session token", async () => {
    const cookie = await api.login(emails.member);
    const token = cookie.split("=")[1];
    const { results } = await api.db.prepare("SELECT id FROM sessions").all<{ id: string }>();
    expect(results).toHaveLength(1);
    expect(results[0].id).not.toBe(token);
    expect(results[0].id).toMatch(/^[0-9a-f]{64}$/);
  });

  it("pauses sign-in after 10 wrong passwords", async () => {
    for (let i = 0; i < 10; i++) {
      await api.call("POST", "/api/auth/login", {
        body: { email: emails.user, password: `wrong-${i}` },
      });
    }
    const blocked = await api.call("POST", "/api/auth/login", {
      body: { email: emails.user, password: "esn-demo-2026" },
    });
    expect(blocked.status).toBe(429);
  });

  it("changes the password and signs out other devices", async () => {
    const laptop = await api.login(emails.user);
    const phone = await api.login(emails.user);
    const short = await api.call("POST", "/api/auth/password", {
      cookie: laptop,
      body: { currentPassword: "esn-demo-2026", newPassword: "short" },
    });
    expect(short.status).toBe(400);
    const changed = await api.call("POST", "/api/auth/password", {
      cookie: laptop,
      body: { currentPassword: "esn-demo-2026", newPassword: "a-much-better-password" },
    });
    expect(changed.status).toBe(204);
    expect((await api.call("GET", "/api/auth/me", { cookie: laptop })).status).toBe(200);
    expect((await api.call("GET", "/api/auth/me", { cookie: phone })).status).toBe(401);
    await expect(api.login(emails.user, "a-much-better-password")).resolves.toMatch(
      /^esn_session=/,
    );
  });
});

const newEvent = {
  title: "Pub Quiz Night",
  summary: "Test your knowledge in teams and win ESN prizes.",
  category: "social",
  status: "scheduled",
  startDate: "2026-12-10",
  startTime: "19:30",
  location: "Waxy's Irish Pub",
};

describe("members and roles", () => {
  it("shows the public only event hosts, without e-mails", async () => {
    const pub = await api.call("GET", "/api/members");
    expect(pub.status).toBe(200);
    expect(pub.data.length).toBeGreaterThan(0);
    expect(pub.data.length).toBeLessThan(12);
    expect(pub.data.every((m: { email?: string }) => m.email === undefined)).toBe(true);

    // Accepted accounts see all accepted people; pending registrations stay hidden.
    const cookie = await api.login(emails.user);
    const all = await api.call("GET", "/api/members", { cookie });
    expect(all.data).toHaveLength(12);
    expect(MemberSchema.array().parse(all.data)[0].email).toContain("@");
    expect(all.data.some((m: { status: string }) => m.status === "pending")).toBe(false);
  });

  it("lets moderators create, edit and remove accounts", async () => {
    const moderator = await api.login(emails.moderator);
    const created = await api.call("POST", "/api/members", {
      cookie: moderator,
      body: {
        name: "Pia Neumann",
        email: "Pia@ESN-Frankfurt.example",
        role: "user",
        team: "Events",
        password: "welcome-pia-2026",
      },
    });
    expect(created.status).toBe(201);
    expect(created.data).toMatchObject({
      name: "Pia Neumann",
      email: "pia@esn-frankfurt.example",
      status: "active",
    });
    const id = created.data.id;

    // The new account can sign in.
    const pia = await api.login("pia@esn-frankfurt.example", "welcome-pia-2026");
    expect((await api.call("GET", "/api/auth/me", { cookie: pia })).data.id).toBe(id);

    const duplicate = await api.call("POST", "/api/members", {
      cookie: moderator,
      body: {
        name: "Other",
        email: "pia@esn-frankfurt.example",
        role: "user",
        password: "0123456789",
      },
    });
    expect(duplicate.status).toBe(409);

    const promoted = await api.call("PATCH", `/api/members/${id}`, {
      cookie: moderator,
      body: { role: "member", team: null },
    });
    expect(promoted.data).toMatchObject({ role: "member" });
    expect(promoted.data.team).toBeUndefined();

    // A password reset by a moderator signs the person out.
    await api.call("PATCH", `/api/members/${id}`, {
      cookie: moderator,
      body: { password: "new-password-for-pia" },
    });
    expect((await api.call("GET", "/api/auth/me", { cookie: pia })).status).toBe(401);

    expect((await api.call("DELETE", `/api/members/${id}`, { cookie: moderator })).status).toBe(
      204,
    );
    expect((await api.call("GET", `/api/members/${id}`, { cookie: moderator })).status).toBe(404);
  });

  it("only lets moderators manage people", async () => {
    const member = await api.login(emails.member);
    const user = await api.login(emails.user);
    const body = { name: "X Y", email: "x@y.example", role: "moderator", password: "0123456789" };
    expect((await api.call("POST", "/api/members", { cookie: member, body })).status).toBe(403);
    expect((await api.call("POST", "/api/members", { body })).status).toBe(401);
    expect(
      (
        await api.call("POST", "/api/members/m-ana/approve", {
          cookie: member,
          body: { role: "user" },
        })
      ).status,
    ).toBe(403);

    // Everyone may change their own name and team, but not their role.
    const own = await api.call("PATCH", "/api/members/m-lucas", {
      cookie: user,
      body: { name: "Lucas M." },
    });
    expect(own.data.name).toBe("Lucas M.");
    const role = await api.call("PATCH", "/api/members/m-lucas", {
      cookie: user,
      body: { role: "moderator" },
    });
    expect(role.status).toBe(403);
    const other = await api.call("PATCH", "/api/members/m-yuki", {
      cookie: user,
      body: { name: "Hacked" },
    });
    expect(other.status).toBe(403);
    expect((await api.call("DELETE", "/api/members/m-yuki", { cookie: member })).status).toBe(403);
  });

  it("moderators can't manage events or shifts", async () => {
    const moderator = await api.login(emails.moderator);
    const res = await api.call("POST", "/api/events", { cookie: moderator, body: newEvent });
    expect(res.status).toBe(403);
    // …but they can still take a shift spot like any accepted account.
    const tasks = await api.call("GET", "/api/events/international-dinner-2026-12-08/tasks", {
      cookie: moderator,
    });
    expect(tasks.status).toBe(200);
  });

  it("gives admins every right: people, events and shifts", async () => {
    const lena = await api.login(emails.moderator);
    await api.call("PATCH", "/api/members/m-sofia", { cookie: lena, body: { role: "admin" } });
    const sofia = await api.login("sofia@esn-frankfurt.example");
    expect((await api.call("POST", "/api/events", { cookie: sofia, body: newEvent })).status).toBe(
      201,
    );
    const accepted = await api.call("POST", "/api/members/m-ana/approve", {
      cookie: sofia,
      body: { role: "user" },
    });
    expect(accepted.status).toBe(200);
    // An admin counts as a moderator, so Lena may now step down.
    const stepDown = await api.call("PATCH", "/api/members/m-lena", {
      cookie: lena,
      body: { role: "user" },
    });
    expect(stepDown.data.role).toBe("user");
  });

  it("always keeps one moderator and never removes yourself", async () => {
    const lena = await api.login(emails.moderator);
    expect((await api.call("DELETE", "/api/members/m-lena", { cookie: lena })).status).toBe(400);
    const last = await api.call("PATCH", "/api/members/m-lena", {
      cookie: lena,
      body: { role: "user" },
    });
    expect(last.status).toBe(409);
    expect(last.data.error).toMatch(/at least one moderator/);

    // With a second moderator, stepping down works.
    await api.call("PATCH", "/api/members/m-mateo", { cookie: lena, body: { role: "moderator" } });
    const stepDown = await api.call("PATCH", "/api/members/m-lena", {
      cookie: lena,
      body: { role: "member" },
    });
    expect(stepDown.data.role).toBe("member");
  });

  it("keeps review notes when their author is removed", async () => {
    const lena = await api.login(emails.moderator);
    expect((await api.call("DELETE", "/api/members/m-mateo", { cookie: lena })).status).toBe(204);
    const notes = await api.call("GET", "/api/events/halloween-party-2026-10-30/reviews", {
      cookie: lena,
    });
    const parsed = ReviewNoteSchema.array().parse(notes.data);
    expect(parsed.some((n) => n.authorId === "former-member")).toBe(true);
  });
});

describe("registration and moderation", () => {
  const registration = {
    name: "Nora Klein",
    email: "Nora@Student.example",
    password: "my-own-password-1",
  };

  it("registers a pending account that can only wait for approval", async () => {
    const res = await api.call("POST", "/api/auth/register", { body: registration });
    expect(res.status).toBe(201);
    expect(res.data).toMatchObject({
      name: "Nora Klein",
      email: "nora@student.example",
      role: "user",
      status: "pending",
    });
    const cookie = res.headers.get("set-cookie")!.split(";")[0];

    // Signed in, but no team data until accepted.
    expect((await api.call("GET", "/api/auth/me", { cookie })).data.status).toBe("pending");
    const tasks = await api.call("GET", "/api/events/international-dinner-2026-12-08/tasks", {
      cookie,
    });
    expect(tasks.status).toBe(403);
    expect(tasks.data.error).toMatch(/waiting for a moderator/);
    const members = await api.call("GET", "/api/members", { cookie });
    expect(members.data.every((m: { email?: string }) => m.email === undefined)).toBe(true);
    const info = await api.call("GET", "/api/events/team-info", { cookie });
    expect(info.data.every((i: { notes: string }) => i.notes === "")).toBe(true);

    // Signing in again later works and still says pending.
    const again = await api.call("POST", "/api/auth/login", {
      body: { email: "nora@student.example", password: registration.password },
    });
    expect(again.data.status).toBe("pending");
  });

  it("validates registrations and refuses taken e-mails", async () => {
    const short = await api.call("POST", "/api/auth/register", {
      body: { ...registration, password: "short" },
    });
    expect(short.status).toBe(400);
    expect(short.data.error).toBe("Use at least 10 characters");
    const taken = await api.call("POST", "/api/auth/register", {
      body: { ...registration, email: emails.user },
    });
    expect(taken.status).toBe(409);
  });

  it("lets a moderator accept people with a role, or reject them", async () => {
    const res = await api.call("POST", "/api/auth/register", { body: registration });
    const nora = res.headers.get("set-cookie")!.split(";")[0];
    const id = res.data.id;
    const moderator = await api.login(emails.moderator);

    // Moderators see pending registrations, with when they registered.
    const list = await api.call("GET", "/api/members", { cookie: moderator });
    const pending = list.data.filter((m: { status: string }) => m.status === "pending");
    expect(pending.map((m: { name: string }) => m.name).sort()).toEqual([
      "Ana Silva",
      "Nora Klein",
      "Tom Becker",
    ]);
    expect(pending[0].createdAt).toBeTruthy();

    const accepted = await api.call("POST", `/api/members/${id}/approve`, {
      cookie: moderator,
      body: { role: "member" },
    });
    expect(accepted.data).toMatchObject({ status: "active", role: "member" });

    // Nora's existing session now has member rights.
    expect((await api.call("GET", "/api/auth/me", { cookie: nora })).data.status).toBe("active");
    const created = await api.call("POST", "/api/events", { cookie: nora, body: newEvent });
    expect(created.status).toBe(201);

    // Rejecting a registration deletes it.
    expect((await api.call("DELETE", "/api/members/m-tom", { cookie: moderator })).status).toBe(
      204,
    );
    const login = await api.call("POST", "/api/auth/login", {
      body: { email: "tom@student.example", password: "esn-demo-2026" },
    });
    expect(login.status).toBe(401);
  });
});

describe("events", () => {
  it("lists events publicly in the frontend's format", async () => {
    const list = await api.call("GET", "/api/events");
    expect(list.data).toHaveLength(132);
    expect(EsnEventSchema.array().parse(list.data)[0].startDate <= list.data[1].startDate).toBe(
      true,
    );
    const one = await api.call("GET", "/api/events/international-dinner-2026-12-08");
    expect(EsnEventSchema.parse(one.data).title).toBe("International Dinner");
    expect((await api.call("GET", "/api/events/nope")).status).toBe(404);
  });

  it("lets members create, edit and remove events", async () => {
    const user = await api.login(emails.user);
    expect((await api.call("POST", "/api/events", { cookie: user, body: newEvent })).status).toBe(
      403,
    );

    const member = await api.login(emails.member);
    const invalid = await api.call("POST", "/api/events", {
      cookie: member,
      body: { ...newEvent, title: "" },
    });
    expect(invalid.status).toBe(400);
    expect(invalid.data.error).toBe("Give the event a title");

    const created = await api.call("POST", "/api/events", { cookie: member, body: newEvent });
    expect(created.status).toBe(201);
    expect(EsnEventSchema.parse(created.data)).toMatchObject({
      slug: "pub-quiz-night-2026-12-10",
      description: newEvent.summary,
    });
    const again = await api.call("POST", "/api/events", { cookie: member, body: newEvent });
    expect(again.data.slug).toBe("pub-quiz-night-2026-12-10-2");

    const edited = await api.call("PUT", "/api/events/pub-quiz-night-2026-12-10", {
      cookie: member,
      body: { ...newEvent, title: "Christmas Pub Quiz", startTime: undefined },
    });
    expect(edited.data).toMatchObject({
      title: "Christmas Pub Quiz",
      slug: "pub-quiz-night-2026-12-10",
    });
    expect(edited.data.startTime).toBeUndefined();

    // Removing an event also removes its shifts.
    const shift = await api.call("POST", "/api/events/pub-quiz-night-2026-12-10/tasks", {
      cookie: member,
      body: { kind: "shift", title: "Quizmaster", startTime: "19:00", peopleNeeded: 1 },
    });
    expect(shift.status).toBe(201);
    expect(
      (await api.call("DELETE", "/api/events/pub-quiz-night-2026-12-10", { cookie: member }))
        .status,
    ).toBe(204);
    expect((await api.call("GET", `/api/tasks/${shift.data.id}`)).status).toBe(404);
    const row = await api.db
      .prepare("SELECT COUNT(*) AS n FROM tasks WHERE id = ?")
      .bind(shift.data.id)
      .first<{ n: number }>();
    expect(row?.n).toBe(0);
  });

  it("groups sub-events under a main event, one level deep", async () => {
    const murder = await api.call("GET", "/api/events/criminalp-murder-mystery-2026-11-22");
    expect(murder.data.parentSlug).toBe("criminalp-2026-11-20");
    const all = (await api.call("GET", "/api/events")).data as { parentSlug?: string }[];
    expect(all.filter((e) => e.parentSlug === "criminalp-2026-11-20")).toHaveLength(3);

    const member = await api.login(emails.member);
    const sub = { ...newEvent, title: "CriminaLP: Brunch", parentSlug: "criminalp-2026-11-20" };
    const created = await api.call("POST", "/api/events", { cookie: member, body: sub });
    expect(created.status).toBe(201);
    expect(created.data.parentSlug).toBe("criminalp-2026-11-20");

    const refuse = async (method: string, path: string, body: object, error: string) => {
      const res = await api.call(method, path, { cookie: member, body });
      expect(res.status).toBe(400);
      expect(res.data.error).toBe(error);
    };
    // No sub-events of sub-events, no loops, no unknown main events.
    await refuse(
      "POST",
      "/api/events",
      { ...newEvent, parentSlug: created.data.slug },
      "“CriminaLP: Brunch” is a sub-event itself, so it can't have sub-events.",
    );
    await refuse(
      "PUT",
      "/api/events/criminalp-2026-11-20",
      { ...newEvent, parentSlug: "international-dinner-2026-12-08" },
      "This event has sub-events of its own, so it can't be part of another event.",
    );
    await refuse(
      "PUT",
      "/api/events/international-dinner-2026-12-08",
      { ...newEvent, parentSlug: "international-dinner-2026-12-08" },
      "An event can't be part of itself.",
    );
    await refuse(
      "POST",
      "/api/events",
      { ...newEvent, parentSlug: "no-such-event" },
      "The main event doesn't exist (anymore).",
    );

    // Editing without a main event detaches it.
    const detached = await api.call("PUT", `/api/events/${created.data.slug}`, {
      cookie: member,
      body: { ...sub, parentSlug: undefined },
    });
    expect(detached.data.parentSlug).toBeUndefined();

    // Removing the main event keeps its sub-events as stand-alone events.
    expect(
      (await api.call("DELETE", "/api/events/criminalp-2026-11-20", { cookie: member })).status,
    ).toBe(204);
    const after = await api.call("GET", "/api/events/criminalp-murder-mystery-2026-11-22");
    expect(after.status).toBe(200);
    expect(after.data.parentSlug).toBeUndefined();
  });

  it("shares hosts publicly but notes and links only with members", async () => {
    const pub = await api.call("GET", "/api/events/team-info");
    const dinner = pub.data.find(
      (i: { eventSlug: string }) => i.eventSlug === "international-dinner-2026-12-08",
    );
    expect(dinner.hostIds).toEqual(["m-chiara", "m-aisha"]);
    expect(dinner.notes).toBe("");
    expect(dinner.links).toEqual([]);

    const member = await api.login(emails.member);
    const team = await api.call("GET", "/api/events/team-info", { cookie: member });
    const full = EventTeamInfoSchema.array()
      .parse(team.data)
      .find((i) => i.eventSlug === dinner.eventSlug)!;
    expect(full.notes).toMatch(/Each participant brings one dish/);
    expect(full.links.length).toBeGreaterThan(0);

    const updated = await api.call("PUT", "/api/events/international-dinner-2026-12-08/team-info", {
      cookie: member,
      body: {
        hostIds: ["m-jonas", "m-unknown", "m-jonas"],
        links: [{ id: "l1", label: "Form", url: "https://forms.example.org/x" }],
      },
    });
    expect(updated.status).toBe(200);
    expect(updated.data).toMatchObject({ hostIds: ["m-jonas"], updatedBy: "m-aisha" });
    expect(updated.data.notes).toMatch(/Each participant/); // untouched

    const badLink = await api.call("PUT", "/api/events/international-dinner-2026-12-08/team-info", {
      cookie: member,
      body: { links: [{ id: "l1", label: "Form", url: "https://not a url" }] },
    });
    expect(badLink.status).toBe(400);
    const user = await api.login(emails.user);
    expect(
      (
        await api.call("PUT", "/api/events/international-dinner-2026-12-08/team-info", {
          cookie: user,
          body: { notes: "hi" },
        })
      ).status,
    ).toBe(403);
  });
});

describe("repeating events", () => {
  // A week from today, so the dates are always in the future.
  const first = addDaysIso(getBerlinToday(), 7);
  const date = (week: number) => addDaysIso(first, 7 * week);
  const cafe = {
    event: {
      title: "Tandem Evening",
      summary: "Practise languages over coffee and cake.",
      category: "social",
      status: "scheduled",
      startDate: first,
      startTime: "19:00",
      location: "Café Kante",
    },
    recurrence: { frequency: "weekly", interval: 1, count: 5 },
    hostIds: ["m-aisha"],
  };
  const slug = (week: number) => `tandem-evening-${date(week)}`;
  const cafeSlugs = async () =>
    ((await api.call("GET", "/api/events")).data as { slug: string; seriesId?: string }[])
      .filter((e) => e.seriesId)
      .map((e) => e.slug);

  it("is stored once and listed date by date", async () => {
    const user = await api.login(emails.user);
    expect((await api.call("POST", "/api/series", { cookie: user, body: cafe })).status).toBe(403);

    const member = await api.login(emails.member);
    const created = await api.call("POST", "/api/series", { cookie: member, body: cafe });
    expect(created.status).toBe(201);
    expect(created.data.series).toMatchObject({
      slug: "tandem-evening",
      recurrence: { frequency: "weekly", interval: 1, count: 5 },
      hostIds: ["m-aisha"],
    });
    expect(created.data.firstEvent.slug).toBe(slug(0));

    // One series row, no event rows; five generated dates.
    expect(await cafeSlugs()).toEqual([0, 1, 2, 3, 4].map(slug));
    const third = await api.call("GET", `/api/events/${slug(2)}`);
    expect(EsnEventSchema.parse(third.data)).toMatchObject({
      title: "Tandem Evening",
      startDate: date(2),
      startTime: "19:00",
      seriesId: created.data.series.id,
    });
    expect(
      (await api.call("GET", `/api/events/tandem-evening-${addDaysIso(first, 1)}`)).status,
    ).toBe(404);
    // Default hosts show on every date.
    const infos = (await api.call("GET", "/api/events/team-info")).data as {
      eventSlug: string;
      hostIds: string[];
    }[];
    expect(infos.find((i) => i.eventSlug === slug(4))?.hostIds).toEqual(["m-aisha"]);

    const ics = (await api.raw("/api/calendar.ics")).text;
    expect(ics.match(/SUMMARY:Tandem Evening/g)).toHaveLength(5);

    // Regular events with the same name get other slugs than its dates.
    const single = await api.call("POST", "/api/events", {
      cookie: member,
      body: { ...cafe.event, startDate: date(1) },
    });
    expect(single.data.slug).toBe(`${slug(1)}-2`);
    // And a second series with the same name gets its own slug.
    const again = await api.call("POST", "/api/series", { cookie: member, body: cafe });
    expect(again.data.series.slug).toBe("tandem-evening-2");
  });

  it("changes, plans and removes single dates", async () => {
    const member = await api.login(emails.member);
    const { series } = (await api.call("POST", "/api/series", { cookie: member, body: cafe })).data;

    // Only this date: it's stored on its own with the same id and slug.
    const moved = await api.call("PUT", `/api/events/${slug(1)}`, {
      cookie: member,
      body: { ...cafe.event, startDate: date(1), startTime: "20:00" },
    });
    expect(moved.status).toBe(200);
    expect(moved.data).toMatchObject({
      slug: slug(1),
      id: `${series.id}-${date(1)}`,
      startTime: "20:00",
    });

    // Shifts on a generated date store that date first (with the series' hosts).
    const shift = await api.call("POST", `/api/events/${slug(2)}/tasks`, {
      cookie: member,
      body: { kind: "task", title: "Bring name tags", peopleNeeded: 1 },
    });
    expect(shift.status).toBe(201);
    const info = (await api.call("GET", "/api/events/team-info")).data as {
      eventSlug: string;
      hostIds: string[];
    }[];
    expect(info.find((i) => i.eventSlug === slug(2))?.hostIds).toEqual(["m-aisha"]);
    expect(await cafeSlugs()).toEqual([0, 1, 2, 3, 4].map(slug));

    // A date can't be a main event or a sub-event.
    const refused = await api.call("POST", "/api/events", {
      cookie: member,
      body: { ...newEvent, parentSlug: slug(3) },
    });
    expect(refused.data.error).toBe("A date of a repeating event can't have sub-events.");

    // Removing single dates, generated or stored.
    for (const week of [0, 1]) {
      expect(
        (await api.call("DELETE", `/api/events/${slug(week)}`, { cookie: member })).status,
      ).toBe(204);
    }
    expect(await cafeSlugs()).toEqual([2, 3, 4].map(slug));
    expect((await api.call("GET", `/api/events/${slug(0)}`)).status).toBe(404);
    const after = await api.call("GET", `/api/series/${series.id}`);
    expect(after.data.excludedDates).toEqual([date(0), date(1)]);
  });

  it("changes and removes the whole series", async () => {
    const member = await api.login(emails.member);
    const { series } = (await api.call("POST", "/api/series", { cookie: member, body: cafe })).data;
    // Date 2 is stored (it has a task), date 1 too (changed on its own).
    await api.call("POST", `/api/events/${slug(2)}/tasks`, {
      cookie: member,
      body: { kind: "task", title: "Bring name tags", peopleNeeded: 1 },
    });
    await api.call("PUT", `/api/events/${slug(1)}`, {
      cookie: member,
      body: { ...cafe.event, startDate: date(1), title: "Tandem Evening: Spanish" },
    });

    // Every 2 weeks, later in the evening: dates 0, 2, 4 remain.
    const edited = await api.call("PUT", `/api/series/${series.id}`, {
      cookie: member,
      body: {
        ...cafe,
        event: { ...cafe.event, startTime: "20:00" },
        recurrence: { frequency: "weekly", interval: 2, until: date(4) },
        hostIds: ["m-lena"],
      },
    });
    expect(edited.status).toBe(200);
    expect(edited.data.recurrence).toEqual({ frequency: "weekly", interval: 2, until: date(4) });

    const events = (await api.call("GET", "/api/events")).data as {
      slug: string;
      seriesId?: string;
      startTime?: string;
      title: string;
    }[];
    const bySlug = new Map(events.map((e) => [e.slug, e]));
    expect(await cafeSlugs()).toEqual([0, 2, 4].map(slug));
    // The stored date follows the series, and keeps its task.
    expect(bySlug.get(slug(2))?.startTime).toBe("20:00");
    const tasks = await api.call("GET", `/api/events/${slug(2)}/tasks`, { cookie: member });
    expect(tasks.data).toHaveLength(1);
    // The changed date no longer fits: it stays, as a separate event.
    expect(bySlug.get(slug(1))).toMatchObject({ title: "Tandem Evening: Spanish" });
    expect(bySlug.get(slug(1))?.seriesId).toBeUndefined();

    expect((await api.call("DELETE", `/api/series/${series.id}`, { cookie: member })).status).toBe(
      204,
    );
    expect(await cafeSlugs()).toEqual([]);
    expect((await api.call("GET", `/api/events/${slug(2)}`)).status).toBe(404);
    expect((await api.call("GET", `/api/events/${slug(1)}`)).status).toBe(200);
  });

  it("rejects invalid rules", async () => {
    const member = await api.login(emails.member);
    const res = await api.call("POST", "/api/series", {
      cookie: member,
      body: {
        ...cafe,
        recurrence: { frequency: "weekly", interval: 1, until: addDaysIso(first, -1) },
      },
    });
    expect(res.status).toBe(400);
    expect(res.data.error).toContain("The last date is before the first one");
  });
});

describe("shifts and tasks", () => {
  const slug = "international-dinner-2026-12-08";

  async function createShift(cookie: string, peopleNeeded = 1) {
    const res = await api.call("POST", `/api/events/${slug}/tasks`, {
      cookie,
      body: {
        kind: "shift",
        title: "Welcome desk",
        description: "Greet people",
        startTime: "18:00",
        endTime: "19:00",
        peopleNeeded,
      },
    });
    expect(res.status).toBe(201);
    return EventTaskSchema.parse(res.data);
  }

  it("is only visible to accepted accounts and only managed by members", async () => {
    expect((await api.call("GET", `/api/events/${slug}/tasks`)).status).toBe(401);
    const user = await api.login(emails.user);
    const res = await api.call("POST", `/api/events/${slug}/tasks`, {
      cookie: user,
      body: { kind: "task", title: "Buy plates", peopleNeeded: 1 },
    });
    expect(res.status).toBe(403);
    const member = await api.login(emails.member);
    const noStart = await api.call("POST", `/api/events/${slug}/tasks`, {
      cookie: member,
      body: { kind: "shift", title: "Bar", peopleNeeded: 2 },
    });
    expect(noStart.status).toBe(400);
    expect(noStart.data.error).toBe("Shifts need a start time");
  });

  it("lets users sign themselves up until the shift is full", async () => {
    const member = await api.login(emails.member);
    const lucas = await api.login(emails.user);
    const yuki = await api.login(emails.user2);
    const shift = await createShift(member, 1);

    const otherPerson = await api.call("PUT", `/api/tasks/${shift.id}/assignees/m-yuki`, {
      cookie: lucas,
    });
    expect(otherPerson.status).toBe(403);

    const joined = await api.call("PUT", `/api/tasks/${shift.id}/assignees/m-lucas`, {
      cookie: lucas,
    });
    expect(joined.data.assigneeIds).toEqual(["m-lucas"]);
    const full = await api.call("PUT", `/api/tasks/${shift.id}/assignees/m-yuki`, { cookie: yuki });
    expect(full.status).toBe(409);
    expect(full.data.error).toBe("All spots are already taken.");

    const mine = await api.call("GET", "/api/members/m-lucas/tasks", { cookie: lucas });
    expect(mine.data.map((t: { id: string }) => t.id)).toContain(shift.id);

    // Assignees may tick it off, but not edit it; others may do neither.
    expect(
      (await api.call("PATCH", `/api/tasks/${shift.id}`, { cookie: yuki, body: { done: true } }))
        .status,
    ).toBe(403);
    expect(
      (
        await api.call("PATCH", `/api/tasks/${shift.id}`, {
          cookie: lucas,
          body: { title: "Mine" },
        })
      ).status,
    ).toBe(403);
    const done = await api.call("PATCH", `/api/tasks/${shift.id}`, {
      cookie: lucas,
      body: { done: true },
    });
    expect(done.data.done).toBe(true);

    const left = await api.call("DELETE", `/api/tasks/${shift.id}/assignees/m-lucas`, {
      cookie: lucas,
    });
    expect(left.data.assigneeIds).toEqual([]);
  });

  it("lets members edit, clear fields and delete", async () => {
    const member = await api.login(emails.member);
    const shift = await createShift(member, 2);
    await api.call("PUT", `/api/tasks/${shift.id}/assignees/m-lucas`, { cookie: member });
    await api.call("PUT", `/api/tasks/${shift.id}/assignees/m-yuki`, { cookie: member });

    const shrink = await api.call("PATCH", `/api/tasks/${shift.id}`, {
      cookie: member,
      body: { peopleNeeded: 1 },
    });
    expect(shrink.status).toBe(409);

    const asTask = await api.call("PATCH", `/api/tasks/${shift.id}`, {
      cookie: member,
      body: { kind: "task", startTime: null, endTime: null, title: "Buy plates" },
    });
    expect(asTask.status).toBe(200);
    expect(asTask.data).toMatchObject({ kind: "task", title: "Buy plates" });
    expect(asTask.data.startTime).toBeUndefined();

    expect((await api.call("DELETE", `/api/tasks/${shift.id}`, { cookie: member })).status).toBe(
      204,
    );
    expect((await api.call("DELETE", `/api/tasks/${shift.id}`, { cookie: member })).status).toBe(
      404,
    );
  });
});

describe("review notes", () => {
  it("lets members add notes and remove only their own", async () => {
    const slug = "halloween-party-2026-10-30";
    const lucas = await api.login(emails.user);
    const yuki = await api.login(emails.user2);
    const added = await api.call("POST", `/api/events/${slug}/reviews`, {
      cookie: lucas,
      body: { kind: "improve", text: "More snacks next time" },
    });
    expect(added.status).toBe(201);
    expect(ReviewNoteSchema.parse(added.data).authorId).toBe("m-lucas");
    expect(
      (await api.call("DELETE", `/api/reviews/${added.data.id}`, { cookie: yuki })).status,
    ).toBe(403);
    expect(
      (await api.call("DELETE", `/api/reviews/${added.data.id}`, { cookie: lucas })).status,
    ).toBe(204);
  });
});

describe("browser security", () => {
  it("rejects changes from other websites", async () => {
    const cookie = await api.login(emails.member);
    const res = await api.call("POST", "/api/events", {
      cookie,
      body: newEvent,
      origin: "https://evil.example",
    });
    expect(res.status).toBe(403);
  });

  it("allows the frontend origin with credentials (CORS)", async () => {
    const res = await api.call("OPTIONS", "/api/events", { origin: "http://localhost:3000" });
    expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:3000");
    expect(res.headers.get("access-control-allow-credentials")).toBe("true");
    const evil = await api.call("GET", "/api/events", { origin: "https://evil.example" });
    expect(evil.headers.get("access-control-allow-origin")).toBeNull();
  });
});

describe("calendar feed", () => {
  it("serves all events as an iCalendar feed for Google/Apple/Outlook", async () => {
    const res = await api.raw("/api/calendar.ics");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/calendar; charset=utf-8");
    const ics = res.text;
    expect(ics.startsWith("BEGIN:VCALENDAR")).toBe(true);
    expect(ics).toContain("\r\nEND:VCALENDAR");
    expect(ics).toContain("X-WR-CALNAME:ESN Frankfurt Events");
    expect(ics).toContain("REFRESH-INTERVAL;VALUE=DURATION:PT1H");
    expect(ics.match(/BEGIN:VEVENT/g)?.length).toBeGreaterThan(100);
    // Stable UIDs, Berlin times, links back to the site.
    expect(ics).toContain("UID:ice-skating-2026-11-26@esn-frankfurt-events");
    expect(ics).toContain("DTSTART;TZID=Europe/Berlin:20261201T183000");
    expect(ics).toContain("URL:http://localhost:3000/events/ice-skating-2026-11-26");
    // Team notes are internal and never published.
    expect(ics).not.toContain("Skate rental is paid on site");
  });

  it("follows changes: new events appear, cancelled ones disappear", async () => {
    const member = await api.login(emails.member);
    await api.call("POST", "/api/events", { cookie: member, body: newEvent });
    let ics = (await api.raw("/api/calendar.ics")).text;
    expect(ics).toContain("SUMMARY:Pub Quiz Night");

    await api.call("PUT", "/api/events/pub-quiz-night-2026-12-10", {
      cookie: member,
      body: { ...newEvent, status: "cancelled" },
    });
    ics = (await api.raw("/api/calendar.ics")).text;
    expect(ics).not.toContain("SUMMARY:Pub Quiz Night");
  });

  it("can be limited to some categories", async () => {
    const ics = (await api.raw("/api/calendar.ics?categories=trips,nonsense")).text;
    expect(ics).toContain("SUMMARY:Strasbourg Day Trip");
    expect(ics).not.toContain("SUMMARY:Ice Skating");
  });
});
