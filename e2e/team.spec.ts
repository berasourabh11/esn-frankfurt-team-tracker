import { expect, test, type Page } from "@playwright/test";

const EVENT = "/events/international-dinner-2026-12-08";
const PAST_EVENT = "/events/halloween-party-2026-10-30";

async function signInAs(page: Page, name: string) {
  const signIn = page.locator("#team").getByRole("button", { name: "Sign in" });
  await signIn.click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: new RegExp(name) })
    .click();
  await expect(page.locator("#team")).toContainText(`Signed in as ${name}`);
}

test.describe("Team area", () => {
  test("is hidden from public visitors", async ({ page }) => {
    await page.goto(EVENT);
    const team = page.locator("#team");
    await expect(team.getByRole("button", { name: "Sign in" })).toBeVisible();
    await expect(team.getByText("Set-up")).toHaveCount(0);
  });

  test("organiser creates a shift, assigns someone; a volunteer takes a spot", async ({ page }) => {
    await page.goto(EVENT);
    await signInAs(page, "Aisha Khan");
    const team = page.locator("#team");

    await team.getByRole("button", { name: "Add shift or task" }).click();
    const form = page.getByRole("dialog", { name: "New shift" });
    await form.getByLabel("Title").fill("Music & playlist");
    await form.getByLabel("Description").fill("Bring the speaker and run the playlist.");
    await form.getByLabel("Start").fill("18:30");
    await form.getByLabel("End").fill("22:00");
    await form.getByLabel("People needed").fill("2");
    await form.getByRole("button", { name: "Add shift" }).click();

    const card = team.getByRole("article", { name: "Music & playlist" });
    await expect(card).toContainText("18:30 – 22:00");
    await expect(card).toContainText("0 of 2");
    // The new shift appears in the shift plan timeline.
    await expect(
      team.getByRole("link", { name: "Music & playlist, 18:30–22:00, 0 of 2 people" }),
    ).toBeVisible();

    await card.getByRole("button", { name: "Assign people" }).click();
    const assign = page.getByRole("dialog", { name: "Assign people" });
    await assign.getByRole("checkbox", { name: /Omar Haddad/ }).click();
    await expect(assign.getByRole("checkbox", { name: /Omar Haddad/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await page.keyboard.press("Escape");
    await expect(card).toContainText("1 of 2");

    // Switch user: a volunteer takes the remaining spot.
    await page.getByRole("button", { name: /Account menu/ }).click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await signInAs(page, "Lucas Martin");
    await expect(card.getByRole("button", { name: "Assign people" })).toHaveCount(0);
    await card.getByRole("button", { name: "Take this shift" }).click();
    await expect(card).toContainText("2 of 2");
    await expect(card).toContainText("Fully staffed");

    // It shows up in "My shifts & tasks".
    await page.goto("/team");
    await expect(page.getByRole("link", { name: /Music & playlist/ })).toBeVisible();
  });

  test("team members add review notes after the event", async ({ page }) => {
    await page.goto(PAST_EVENT);
    await signInAs(page, "Yuki Tanaka");
    const team = page.locator("#team");

    // Past events open on the review tab.
    await expect(team.getByRole("tab", { name: /Event review/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    const improve = team.getByRole("region", { name: "What could be better" });
    await improve.getByRole("textbox").fill("Bring more cups for the bar");
    await improve.getByRole("button", { name: "Add note" }).click();
    await expect(improve).toContainText("Bring more cups for the bar");
    await expect(improve).toContainText("Yuki Tanaka");

    await page.reload();
    await expect(
      page.locator("#team").getByRole("region", { name: "What could be better" }),
    ).toContainText("Bring more cups for the bar");
  });

  test("review is not open before the event happens", async ({ page }) => {
    await page.goto("/events/valentine-s-party-2027-02-13");
    await signInAs(page, "Elif Demir");
    await page
      .locator("#team")
      .getByRole("tab", { name: /Event review/ })
      .click();
    await expect(page.getByText("The review opens once the event has happened")).toBeVisible();
  });
});
