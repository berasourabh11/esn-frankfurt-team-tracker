import { expect, test, type Page } from "@playwright/test";

async function signInFromHeader(page: Page, name: string) {
  await page.getByRole("banner").getByRole("button", { name: /Team/ }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: new RegExp(name) })
    .click();
  await expect(page.getByRole("button", { name: `Account menu for ${name}` })).toBeVisible();
}

test.describe("Moderation", () => {
  test("a moderator accepts and rejects registrations and changes roles", async ({ page }) => {
    await page.goto("/");
    await signInFromHeader(page, "Lena Hoffmann");
    await page.getByRole("button", { name: "Account menu for Lena Hoffmann" }).click();
    await page.getByRole("menuitem", { name: "Moderation" }).click();
    await expect(page).toHaveURL(/\/moderation$/);

    const waiting = page.getByRole("region", { name: /Waiting for approval/ });
    await expect(waiting).toContainText("Ana Silva");
    await expect(waiting).toContainText("Tom Becker");

    // Accept Ana as a member.
    await waiting.getByLabel("Role for Ana Silva").selectOption("member");
    await waiting.getByRole("button", { name: "Accept Ana Silva" }).click();
    await expect(page.getByText("Ana Silva was accepted as member.")).toBeVisible();
    const people = page.getByRole("region", { name: /People & roles/ });
    await expect(people.getByLabel("Role for Ana Silva")).toHaveValue("member");

    // Reject Tom.
    await waiting.getByRole("button", { name: "Reject Tom Becker" }).click();
    await page.getByRole("button", { name: "Reject registration" }).click();
    await expect(waiting).toContainText("No one is waiting right now.");
    await expect(people).not.toContainText("Tom Becker");

    // Make Lucas a member.
    await people.getByLabel("Role for Lucas Martin").selectOption("member");
    await expect(page.getByText("Lucas Martin is now member.")).toBeVisible();

    // The last moderator can't step down.
    await people.getByLabel("Role for Lena Hoffmann").selectOption("user");
    await expect(
      page.getByRole("alert").filter({ hasText: "There must always be at least one moderator." }),
    ).toBeVisible();
    await expect(people.getByLabel("Role for Lena Hoffmann")).toHaveValue("moderator");
  });

  test("is only for moderators", async ({ page }) => {
    await page.goto("/");
    await signInFromHeader(page, "Aisha Khan");
    await expect(page.getByRole("link", { name: "Moderation" })).toHaveCount(0);
    await page.goto("/moderation");
    await expect(page.getByRole("heading", { name: "Moderators only" })).toBeVisible();
  });
});
