import { expect, test } from "@playwright/test";

test.describe("Event details", () => {
  test("clicking an event opens its own page, and back returns to the feed", async ({ page }) => {
    await page.goto("/");
    const firstLink = page.locator("#events article h3 a").first();
    const title = (await firstLink.textContent())!.trim();
    await firstLink.click();

    await expect(page).toHaveURL(/\/events\//);
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Google Calendar" })).toBeVisible();
    await expect(page.locator("#team")).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator("#events article").first()).toBeVisible();
  });

  test("renders a full, shareable page with SEO metadata on direct visit", async ({ page }) => {
    await page.goto("/events/welcome-week-padel-tennis-2026-09-10");
    await expect(
      page.getByRole("heading", { level: 1, name: "Welcome Week: Padel Tennis" }),
    ).toBeVisible();
    const facts = page.getByRole("region", { name: "Event details" });
    await expect(
      facts.getByRole("definition").filter({ hasText: "Hockey Factory Karben" }),
    ).toBeVisible();
    await expect(facts.getByRole("definition").filter({ hasText: "18:00 – 20:00" })).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await expect(page).toHaveTitle(/Welcome Week: Padel Tennis/);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
      "content",
      "Welcome Week: Padel Tennis",
    );
    await expect(page.locator('meta[property="og:image"]').first()).toHaveAttribute(
      "content",
      /opengraph-image/,
    );
    const jsonLd = JSON.parse(
      (await page.locator('script[type="application/ld+json"]').textContent())!,
    );
    expect(jsonLd).toMatchObject({
      "@type": "Event",
      startDate: "2026-09-10T18:00:00+02:00",
    });
  });

  test("shows a not-found page for unknown events", async ({ page }) => {
    // With Partial Prerendering the very first request for an unknown slug may
    // already have streamed a 200 header; Next.js then marks it noindex instead.
    const response = await page.goto(`/events/does-not-exist-${Date.now()}`);
    expect([200, 404]).toContain(response?.status());
    await expect(page.getByRole("heading", { name: /couldn.t find that event/ })).toBeVisible();
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
  });
});
