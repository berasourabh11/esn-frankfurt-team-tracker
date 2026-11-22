import { expect, test, type Page } from "@playwright/test";

async function signInFromHeader(page: Page, name: string) {
  await page.getByRole("banner").getByRole("button", { name: /Team/ }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: new RegExp(name) })
    .click();
  await expect(page.getByRole("button", { name: `Account menu for ${name}` })).toBeVisible();
}

test.describe("Sub-events", () => {
  test("a main event lists its programme and sub-events link back", async ({ page }) => {
    await page.goto("/events/criminalp-2026-11-20");
    await expect(page.getByRole("heading", { level: 1, name: "CriminaLP" })).toBeVisible();
    const programme = page.getByRole("region", { name: "Programme" });
    await expect(programme.getByRole("link")).toHaveCount(3);
    // Visitors can't add sub-events.
    await expect(programme.getByRole("button", { name: "Add sub-event" })).toHaveCount(0);

    await programme.getByRole("link", { name: /Murder Mystery/ }).click();
    await expect(page).toHaveURL(/\/events\/criminalp-murder-mystery-2026-11-22$/);
    await page.getByRole("link", { name: "Part of CriminaLP" }).click();
    await expect(page).toHaveURL(/\/events\/criminalp-2026-11-20$/);
  });

  test("a member adds a sub-event to a main event", async ({ page }) => {
    await page.goto("/events/criminalp-2026-11-20");
    await signInFromHeader(page, "Aisha Khan");

    const programme = page.getByRole("region", { name: "Programme" });
    await programme.getByRole("button", { name: "Add sub-event" }).click();
    const form = page.getByRole("dialog", { name: "Add sub-event" });
    // Starts from the main event's details.
    await expect(form.getByLabel("Part of")).toHaveValue("criminalp-2026-11-20");
    await expect(form.getByLabel("Date")).toHaveValue("2026-11-20");
    await form.getByLabel("Title").fill("Crime Scene Brunch");
    await form.getByLabel("Date").fill("2026-11-21");
    await form
      .getByLabel("Short summary")
      .fill("Recover from the kiosk crawl with a detective brunch.");
    await form.getByRole("button", { name: "Add sub-event" }).click();

    await expect(page).toHaveURL(/\/events\/crime-scene-brunch-2026-11-21$/);
    await expect(page.getByRole("link", { name: "Part of CriminaLP" })).toBeVisible();

    await page.getByRole("link", { name: "Part of CriminaLP" }).click();
    await expect(programme.getByRole("link")).toHaveCount(4);
    await expect(programme.getByRole("link").nth(1)).toContainText("Crime Scene Brunch");

    // A main event can't itself become a sub-event.
    await page.getByRole("button", { name: "Edit event" }).click();
    await expect(
      page.getByRole("dialog", { name: "Edit event" }).getByLabel("Part of"),
    ).toBeDisabled();
  });
});
