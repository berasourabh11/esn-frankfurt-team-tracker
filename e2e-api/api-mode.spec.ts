import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "esn-demo-2026";

async function signIn(page: Page, email: string, password = PASSWORD) {
  await page.getByRole("banner").getByRole("button", { name: /Team/ }).click();
  const dialog = page.getByRole("dialog", { name: "Sign in to the ESN team area" });
  await dialog.getByLabel("E-mail").fill(email);
  await dialog.getByLabel("Password").fill(password);
  await dialog.getByRole("button", { name: "Sign in" }).click();
  return dialog;
}

test.describe("With the real API", () => {
  for (const width of [360, 1280]) {
    test(`the subscribe dialog fits without sideways scrolling (${width}px)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/calendar");
      await page.getByRole("banner").getByRole("button", { name: "Subscribe" }).click();
      const dialog = page.getByRole("dialog", { name: "Never miss an ESN event" });
      const copy = dialog.getByRole("button", { name: "Copy link" });
      await expect(copy).toBeVisible();

      const overflow = await dialog.evaluate((el) => el.scrollWidth - el.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
      const [d, c] = await Promise.all([dialog.boundingBox(), copy.boundingBox()]);
      expect(c!.x + c!.width).toBeLessThanOrEqual(d!.x + d!.width);
    });
  }

  test("signs in with e-mail and password and stays signed in", async ({ page }) => {
    await page.goto("/");
    const dialog = await signIn(page, "aisha@esn-frankfurt.example", "wrong-password");
    await expect(dialog.getByRole("alert")).toHaveText("Wrong e-mail or password.");

    await dialog.getByLabel("Password").fill(PASSWORD);
    await dialog.getByRole("button", { name: "Sign in" }).click();
    const menu = page.getByRole("button", { name: "Account menu for Aisha Khan" });
    await expect(menu).toBeVisible();

    await page.reload();
    await expect(menu).toBeVisible();

    await menu.click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(page.getByRole("banner").getByRole("button", { name: /Team/ })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("banner").getByRole("button", { name: /Team/ })).toBeVisible();
  });

  test("someone registers, waits, and a moderator accepts them with a role", async ({
    page,
    browser,
  }) => {
    // A new person registers in their own browser.
    const other = await browser.newContext();
    const nora = await other.newPage();
    await nora.goto("/team");
    await nora.getByRole("banner").getByRole("button", { name: /Team/ }).click();
    await nora.getByRole("button", { name: "Create an account" }).click();
    const form = nora.getByRole("dialog", { name: "Create an account" });
    await form.getByLabel("Your name").fill("Nora Klein");
    await form.getByLabel("E-mail").fill("nora@student.example");
    await form.getByLabel("Password", { exact: true }).fill("short");
    await form.getByRole("button", { name: "Create account" }).click();
    await expect(form.getByText("Use at least 10 characters")).toBeVisible();
    await form.getByLabel("Password", { exact: true }).fill("noras-password-1");
    await form.getByLabel("Repeat password").fill("noras-password-1");
    await form.getByRole("button", { name: "Create account" }).click();
    await expect(form).toBeHidden();
    const waiting = nora.getByRole("status").filter({ hasText: "Waiting for approval" });
    await expect(waiting).toBeVisible();
    await expect(
      nora.getByRole("navigation").first().getByRole("link", { name: "Team" }),
    ).toHaveCount(0);

    // A moderator accepts Nora as a member.
    await page.goto("/moderation");
    await signIn(page, "lena@esn-frankfurt.example");
    const list = page.getByRole("region", { name: /Waiting for approval/ });
    await expect(list).toContainText("Nora Klein");
    await expect(list).toContainText("nora@student.example");
    await list.getByLabel("Role for Nora Klein").selectOption("member");
    await list.getByRole("button", { name: "Accept Nora Klein" }).click();
    await expect(page.getByText("Nora Klein was accepted as member.")).toBeVisible();

    // Nora checks again and now has member access (e.g. adding events).
    await waiting.getByRole("button", { name: "Check again" }).click();
    await expect(nora.getByRole("button", { name: "Account menu for Nora Klein" })).toBeVisible();
    await expect(nora.getByRole("heading", { name: "My shifts & tasks" })).toBeVisible();
    await nora.goto("/");
    await expect(nora.getByRole("button", { name: "Add event" }).first()).toBeVisible();
    await other.close();

    // The moderator rejects another registration.
    const people = page.getByRole("region", { name: /People & roles/ });
    await expect(people.getByLabel("Role for Nora Klein")).toHaveValue("member");
    await list.getByRole("button", { name: "Reject Tom Becker" }).click();
    await page.getByRole("button", { name: "Reject registration" }).click();
    await expect(list).not.toContainText("Tom Becker");
  });

  test("a moderator adds an account, changes its role and removes it", async ({
    page,
    browser,
  }) => {
    await page.goto("/moderation");
    await signIn(page, "lena@esn-frankfurt.example");
    await page.getByRole("button", { name: "Add account" }).click();
    const form = page.getByRole("dialog", { name: "Add account" });
    await form.getByLabel("Name").fill("Pia Neumann");
    await form.getByLabel("E-mail").fill("pia@esn-frankfurt.example");
    await form.getByLabel("Role").selectOption("user");
    await form.getByLabel("First password").fill("welcome-pia-2026");
    await form.getByRole("button", { name: "Add account" }).click();
    await expect(form).toBeHidden();
    const people = page.getByRole("region", { name: /People & roles/ });
    await expect(people).toContainText("pia@esn-frankfurt.example");

    // Pia signs in elsewhere; as a user she can't see moderation.
    const other = await browser.newContext();
    const pia = await other.newPage();
    await pia.goto("/moderation");
    await signIn(pia, "pia@esn-frankfurt.example", "welcome-pia-2026");
    await expect(pia.getByRole("heading", { name: "Moderators only" })).toBeVisible();
    await other.close();

    await people.getByLabel("Role for Pia Neumann").selectOption("moderator");
    await expect(page.getByText("Pia Neumann is now moderator.")).toBeVisible();

    await people.getByRole("button", { name: "Edit Pia Neumann" }).click();
    await page.getByRole("button", { name: "Remove account" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Remove account" }).click();
    await expect(people).not.toContainText("Pia Neumann");
  });

  test("events and shifts are saved in the database", async ({ page, browser }) => {
    await page.goto("/");
    await signIn(page, "aisha@esn-frankfurt.example");
    await expect(page.getByRole("button", { name: "Account menu for Aisha Khan" })).toBeVisible();

    await page.getByRole("button", { name: "Add event" }).first().click();
    const form = page.getByRole("dialog", { name: "Add event" });
    await form.getByLabel("Title").fill("Pub Quiz Night");
    await form.getByLabel("Date").fill("2026-12-10");
    await form.getByLabel("Start").fill("19:30");
    await form.getByLabel("Short summary").fill("Test your knowledge in teams and win ESN prizes.");
    await form.getByRole("checkbox", { name: /Jonas Weber/ }).click();
    await form.getByRole("button", { name: "Add event" }).click();
    await expect(page).toHaveURL(/\/events\/pub-quiz-night-2026-12-10$/);
    await expect(page.getByRole("heading", { level: 1, name: "Pub Quiz Night" })).toBeVisible();

    const team = page.locator("#team");
    await team.getByRole("button", { name: "Add shift or task" }).click();
    const shift = page.getByRole("dialog", { name: "New shift" });
    await shift.getByLabel("Title").fill("Quizmaster");
    await shift.getByLabel("Start").fill("19:00");
    await shift.getByLabel("People needed").fill("1");
    await shift.getByRole("button", { name: "Add shift" }).click();
    await expect(team.getByRole("article", { name: "Quizmaster" })).toContainText("0 of 1");

    // Another person, another browser: the data comes from the API.
    const other = await browser.newContext();
    const lucas = await other.newPage();
    await lucas.goto("/events/pub-quiz-night-2026-12-10");
    await expect(lucas.getByRole("heading", { level: 1, name: "Pub Quiz Night" })).toBeVisible();
    await expect(lucas.getByRole("list", { name: "Hosts" })).toContainText("Jonas Weber");
    await lucas.locator("#team").getByRole("button", { name: "Sign in" }).click();
    const dialog = lucas.getByRole("dialog", { name: "Sign in to the ESN team area" });
    await dialog.getByLabel("E-mail").fill("lucas@esn-frankfurt.example");
    await dialog.getByLabel("Password").fill(PASSWORD);
    await dialog.getByRole("button", { name: "Sign in" }).click();
    const card = lucas.locator("#team").getByRole("article", { name: "Quizmaster" });
    await card.getByRole("button", { name: "Take this shift" }).click();
    await expect(card).toContainText("1 of 1");
    await other.close();

    // Aisha sees Lucas on the shift after reloading.
    await page.reload();
    await expect(team.getByRole("article", { name: "Quizmaster" })).toContainText("1 of 1");

    // Removing the event.
    await page.getByRole("button", { name: "Remove event" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Remove event" }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.goto("/events/pub-quiz-night-2026-12-10");
    await expect(page.getByText(/couldn.t find that event|was removed/)).toBeVisible();
  });
});
