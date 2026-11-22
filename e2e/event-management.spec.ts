import { expect, test, type Page } from "@playwright/test";

async function signInFromHeader(page: Page, name: string) {
  await page.getByRole("banner").getByRole("button", { name: /Team/ }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: new RegExp(name) })
    .click();
  await expect(page.getByRole("button", { name: `Account menu for ${name}` })).toBeVisible();
}

test.describe("Event management", () => {
  test("organiser adds an event with hosts, notes and links, then removes it", async ({ page }) => {
    await page.goto("/");
    await signInFromHeader(page, "Aisha Khan");

    await page.getByRole("button", { name: "Add event" }).first().click();
    const form = page.getByRole("dialog", { name: "Add event" });
    await form.getByRole("button", { name: "Add event" }).click();
    await expect(form.getByText("Give the event a title")).toBeVisible();

    await form.getByLabel("Title").fill("Pub Quiz Night");
    await form.getByLabel("Date").fill("2026-12-10");
    await form.getByLabel("Start").fill("19:30");
    await form.getByLabel("Location").fill("Waxy's Irish Pub");
    await form.getByLabel("Short summary").fill("Test your knowledge in teams and win ESN prizes.");
    await form.getByRole("checkbox", { name: /Jonas Weber/ }).click();
    await form.getByRole("button", { name: "Add event" }).click();

    // Lands on the new event page.
    await expect(page).toHaveURL(/\/events\/pub-quiz-night-2026-12-10$/);
    await expect(page.getByRole("heading", { level: 1, name: "Pub Quiz Night" })).toBeVisible();
    const hosts = page.getByRole("list", { name: "Hosts" });
    await expect(hosts).toContainText("Aisha Khan");
    await expect(hosts).toContainText("Jonas Weber");

    // Team notes & important links.
    await page.getByRole("button", { name: "Add notes" }).click();
    const notes = page.getByRole("dialog", { name: "Notes & important links" });
    await notes.getByLabel("Notes").fill("Reserve the back room.");
    await notes.getByRole("button", { name: "Add link" }).click();
    await notes.getByLabel("Link 1 name").fill("Quiz questions");
    await notes.getByLabel("Link 1 URL").fill("not a url");
    await notes.getByRole("button", { name: "Save" }).click();
    await expect(notes.getByText(/full link/)).toBeVisible();
    await notes.getByLabel("Link 1 URL").fill("docs.example.org/quiz");
    await notes.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Reserve the back room.")).toBeVisible();
    await expect(page.getByRole("link", { name: /Quiz questions/ })).toHaveAttribute(
      "href",
      "https://docs.example.org/quiz",
    );

    // Edit the event.
    await page.getByRole("button", { name: "Edit event" }).click();
    const edit = page.getByRole("dialog", { name: "Edit event" });
    await edit.getByLabel("Title").fill("Christmas Pub Quiz");
    await edit.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Christmas Pub Quiz" })).toBeVisible();

    // Shows up in the feed with host names.
    await page.goto("/?q=quiz");
    const card = page.locator("#events article", { hasText: "Christmas Pub Quiz" });
    await expect(card).toContainText("Hosted by Aisha & Jonas");

    // Remove it.
    await card.getByRole("link").click();
    await page.getByRole("button", { name: "Remove event" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Remove event" }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.goto("/?q=quiz");
    await expect(page.getByRole("heading", { name: "No events match your filters" })).toBeVisible();
  });

  test("volunteers see hosts and notes but no management controls", async ({ page }) => {
    await page.goto("/events/international-dinner-2026-12-08");
    // Hosts are public.
    await expect(page.getByRole("list", { name: "Hosts" })).toContainText("Chiara Bianchi");
    await expect(page.getByText(/Each participant brings one dish/)).toHaveCount(0);

    await page.locator("#team").getByRole("button", { name: "Sign in" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /Lucas Martin/ })
      .click();
    await expect(page.getByText(/Each participant brings one dish/)).toBeVisible();
    await expect(page.getByRole("link", { name: /Who brings what/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit event" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Remove event" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Edit hosts" })).toHaveCount(0);
  });
});
