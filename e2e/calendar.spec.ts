import { expect, test } from "@playwright/test";

const berlinToday = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date());

test.describe("Calendar", () => {
  test("shows the current month with today's agenda", async ({ page }) => {
    await page.goto("/calendar");
    const monthTitle = new Intl.DateTimeFormat("en-GB", {
      month: "long",
      year: "numeric",
      timeZone: "Europe/Berlin",
    }).format(new Date());
    await expect(page.locator("#calendar-title")).toHaveText(monthTitle);
    await expect(page.getByRole("region", { name: monthTitle, exact: true })).toBeVisible();
    await expect(page.locator("#agenda-heading")).toBeVisible();
    await expect(page.getByText("Today", { exact: true }).first()).toBeVisible();
  });

  test("navigates months and returns to today", async ({ page }) => {
    await page.goto("/calendar");
    const title = page.locator("#calendar-title");
    await expect(title).not.toBeEmpty();
    const initial = await title.textContent();

    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(title).not.toHaveText(initial!);
    await expect(page).toHaveURL(/date=/);

    await page.getByRole("button", { name: "Today" }).click();
    await expect(title).toHaveText(initial!);
  });

  test("selecting a day updates the agenda", async ({ page }) => {
    await page.goto(`/calendar?date=2026-12-01`);
    await expect(page.locator("#agenda-heading")).toHaveText("Tuesday, 1 December 2026");
    await expect(page.getByRole("link", { name: /Afro Dance Class/ })).toBeVisible();

    await page.getByRole("button", { name: "Next day" }).click();
    await expect(page.locator("#agenda-heading")).toHaveText("Wednesday, 2 December 2026");
    await expect(page).toHaveURL(/date=2026-12-02/);
  });

  test("opens event details from the agenda", async ({ page }) => {
    await page.goto(`/calendar?date=2026-12-01`);
    await page.getByRole("link", { name: /Afro Dance Class/ }).click();
    await expect(page).toHaveURL(/\/events\/afro-dance-class-2026-12-01/);
    await expect(page.getByRole("heading", { level: 1, name: "Afro Dance Class" })).toBeVisible();
    await expect(page.getByRole("main")).toContainText("18:30 – 20:30");
  });

  test("clicking an event opens a pop-up with a button to the event page", async ({ page }) => {
    await page.goto("/calendar?date=2026-12-01");
    await page.locator(".esn-chip", { hasText: "Afro Dance Class" }).first().click();
    const popup = page.getByRole("dialog", { name: "Afro Dance Class" });
    await expect(popup).toContainText("18:30 – 20:30");
    await expect(popup).toContainText(/notes for this event are visible after signing in/);
    await popup.getByRole("link", { name: "Open event page" }).click();
    await expect(page).toHaveURL(/events\/afro-dance-class-2026-12-01/);
    await expect(page.getByRole("heading", { level: 1, name: "Afro Dance Class" })).toBeVisible();
  });

  test("team members add notes in the pop-up and see them on the calendar", async ({
    page,
    isMobile,
  }) => {
    await page.goto("/calendar?date=2026-11-26");
    await page.getByRole("banner").getByRole("button", { name: /Team/ }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /Aisha Khan/ })
      .click();
    await expect(page.getByRole("button", { name: "Account menu for Aisha Khan" })).toBeVisible();

    await page.locator(".esn-chip", { hasText: "Ice Skating" }).first().click();
    const popup = page.getByRole("dialog", { name: "Ice Skating" });
    await expect(popup.getByRole("list", { name: "Hosts" })).toContainText("Noah Fischer");
    await popup.getByRole("button", { name: "Edit notes" }).click();
    await popup
      .getByRole("textbox", { name: "Notes" })
      .fill("Bring gloves. Meet at the rink entrance at 19:00.");
    await popup.getByRole("button", { name: "Save notes" }).click();
    await expect(popup).toContainText("Bring gloves.");
    await page.keyboard.press("Escape");

    if (!isMobile) {
      // Like the planning sheet: notes are visible right in the calendar.
      await expect(page.locator(".esn-chip", { hasText: "Ice Skating" }).first()).toContainText(
        "Bring gloves.",
      );
    }
  });

  test("today has no date parameter", async ({ page }) => {
    await page.goto("/calendar");
    expect(berlinToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    await expect(page).toHaveURL(/\/calendar$/);
  });
});
