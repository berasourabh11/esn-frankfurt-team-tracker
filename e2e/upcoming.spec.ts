import { expect, test } from "@playwright/test";

test.describe("Upcoming events (landing page)", () => {
  test("introduces ESN Frankfurt and lists grouped events", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { level: 1, name: /What's happening at ESN Frankfurt/ }),
    ).toBeVisible();
    await expect(page.getByRole("status")).toContainText(/upcoming event/);

    const groupHeadings = page.locator("#events h2");
    await expect(groupHeadings.first()).toBeVisible();
    const labels = await groupHeadings.allTextContents();
    const order = ["Today", "Tomorrow", "This Week", "Next Week", "Later"];
    const indexes = labels.map((l) => order.indexOf(l.trim()));
    expect(indexes.every((i) => i >= 0)).toBe(true);
    expect(indexes).toEqual([...indexes].sort((a, b) => a - b));
  });

  test("filters by category and keeps the filter in the URL", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Trips & Travel" }).click();
    await expect(page).toHaveURL(/category=trips/);
    await expect(page.getByRole("status")).toContainText(/match your filters/);

    const cards = page.locator("#events article");
    const count = await cards.count();
    for (let i = 0; i < count; i++) {
      await expect(cards.nth(i)).toContainText("Trips");
    }

    await page.reload();
    await expect(page.getByRole("button", { name: "Trips & Travel" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("shows an empty state for unmatched searches and clears filters", async ({ page }) => {
    await page.goto("/");
    // Wait for the hydrated feed before typing, so the input is interactive.
    await expect(page.getByRole("status")).toContainText(/upcoming event/);
    const search = page.locator("#events").getByRole("searchbox", { name: "Search events" });
    await expect(async () => {
      await search.fill("zzz-no-such-event");
      await expect(page).toHaveURL(/q=zzz-no-such-event/, { timeout: 1500 });
    }).toPass();
    await expect(page.getByRole("heading", { name: "No events match your filters" })).toBeVisible();
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator("#events article").first()).toBeVisible();
  });

  test("header search navigates to filtered results", async ({ page, isMobile }) => {
    await page.goto("/calendar");
    if (isMobile) {
      await page.getByRole("button", { name: "Search events" }).click();
    }
    const search = page
      .getByRole("dialog")
      .getByRole("searchbox")
      .or(page.locator("header").getByRole("searchbox"));
    await search.first().fill("stammtisch");
    await search.first().press("Enter");
    await expect(page).toHaveURL(/\/\?q=stammtisch/);
    await expect(page.locator("#events article").first()).toContainText(/Stammtisch/i);
  });
});
