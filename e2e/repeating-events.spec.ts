import { expect, test, type Page } from "@playwright/test";

async function signInFromHeader(page: Page, name: string) {
  await page.getByRole("banner").getByRole("button", { name: /Team/ }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: new RegExp(name) })
    .click();
  await expect(page.getByRole("button", { name: `Account menu for ${name}` })).toBeVisible();
}

const heading = (page: Page, name: string) => page.getByRole("heading", { level: 1, name });

test.describe("Repeating events", () => {
  test("an organiser adds a weekly event and changes one date or all dates", async ({ page }) => {
    await page.goto("/");
    await signInFromHeader(page, "Aisha Khan");

    await page.getByRole("button", { name: "Add event" }).first().click();
    const form = page.getByRole("dialog", { name: "Add event" });
    await form.getByLabel("Title").fill("Tandem Evening");
    await form.getByLabel("Date", { exact: true }).fill("2027-01-06");
    await form.getByLabel("Start").fill("19:00");
    await form.getByLabel("Short summary").fill("Swap languages with other students.");

    // Repeats every Wednesday, four times.
    await form.getByLabel("How often").selectOption({ label: "Every week on Wednesday" });
    await expect(form.getByLabel("Part of")).toHaveCount(0);
    await form.getByLabel("Stops repeating").selectOption({ label: "After a number of dates" });
    await form.getByRole("button", { name: "Add repeating event" }).click();
    await expect(form.getByText("Enter how many times")).toBeVisible();
    await form.getByLabel("Number of dates").fill("4");
    await expect(form.getByText(/^4 dates: Wed, 6 Jan · Wed, 13 Jan · Wed, 20 Jan/)).toBeVisible();
    await expect(form.getByText(/until Wed, 27 Jan/)).toBeVisible();
    await form.getByRole("button", { name: "Add repeating event" }).click();

    // Every date has its own page.
    await expect(page).toHaveURL(/\/events\/tandem-evening-2027-01-06$/);
    await expect(heading(page, "Tandem Evening")).toBeVisible();
    await expect(page.getByText("Every week on Wednesday")).toBeVisible();
    await page.goto("/events/tandem-evening-2027-01-20");
    await expect(heading(page, "Tandem Evening")).toBeVisible();

    // Only this date: a later start.
    await page.getByRole("button", { name: "Edit event" }).click();
    await page.getByRole("button", { name: "Only this date" }).click();
    const single = page.getByRole("dialog", { name: "Edit this date" });
    await expect(single.getByLabel("How often")).toHaveCount(0);
    await single.getByLabel("Start").fill("20:30");
    await single.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("From 20:30").first()).toBeVisible();

    // Removing this date goes to the next one.
    await page.getByRole("button", { name: "Remove event" }).click();
    await page.getByRole("button", { name: "Remove this date" }).click();
    await expect(page).toHaveURL(/\/events\/tandem-evening-2027-01-27$/);

    // All dates: a new name.
    await page.getByRole("button", { name: "Edit event" }).click();
    await page.getByRole("button", { name: "All dates" }).click();
    const all = page.getByRole("dialog", { name: "Edit repeating event" });
    await expect(all.getByLabel("How often")).toHaveValue("weekly");
    await expect(all.getByLabel("Number of dates")).toHaveValue("4");
    await all.getByLabel("Title").fill("Tandem & Tapas");
    await all.getByRole("button", { name: "Save all dates" }).click();
    await expect(heading(page, "Tandem & Tapas")).toBeVisible();
    await page.goto("/events/tandem-evening-2027-01-13");
    await expect(heading(page, "Tandem & Tapas")).toBeVisible();
    await page.goto("/events/tandem-evening-2027-01-20");
    await expect(page.getByRole("heading", { name: /removed/i })).toBeVisible();

    // Removing every date.
    await page.goto("/events/tandem-evening-2027-01-13");
    await page.getByRole("button", { name: "Remove event" }).click();
    await page.getByRole("button", { name: "Remove all dates" }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.goto("/events/tandem-evening-2027-01-06");
    await expect(heading(page, "Tandem & Tapas")).toHaveCount(0);
  });
});
