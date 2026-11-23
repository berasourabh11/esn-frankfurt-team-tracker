import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page, email: string) {
  await page.getByRole("banner").getByRole("button", { name: /Team/ }).click();
  const dialog = page.getByRole("dialog", { name: "Sign in to the ESN team area" });
  await dialog.getByLabel("E-mail").fill(email);
  await dialog.getByLabel("Password").fill("esn-demo-2026");
  await dialog.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("button", { name: /Account menu/ })).toBeVisible();
}

const heading = (page: Page, name: string) => page.getByRole("heading", { level: 1, name });

test("a repeating event is saved once by the API and shows every date", async ({ page }) => {
  await page.goto("/");
  await signIn(page, "aisha@esn-frankfurt.example");

  await page.getByRole("button", { name: "Add event" }).first().click();
  const form = page.getByRole("dialog", { name: "Add event" });
  await form.getByLabel("Title").fill("Tandem Evening");
  await form.getByLabel("Date", { exact: true }).fill("2027-02-03");
  await form.getByLabel("Start").fill("19:00");
  await form.getByLabel("Short summary").fill("Swap languages with other students.");
  await form.getByLabel("How often").selectOption({ label: "Every 2 weeks on Wednesday" });
  await expect(form.getByText(/Shown up to a year ahead/)).toBeVisible();
  await form.getByRole("button", { name: "Add repeating event" }).click();

  await expect(page).toHaveURL(/\/events\/tandem-evening-2027-02-03$/);
  // A later date, rendered by the server from the API.
  await page.goto("/events/tandem-evening-2027-03-03");
  await expect(heading(page, "Tandem Evening")).toBeVisible();
  await expect(page.getByText("Every 2 weeks on Wednesday")).toBeVisible();
  await expect(page.getByRole("list", { name: "Hosts" })).toContainText("Aisha Khan");

  // Changing only this date keeps the rest.
  await page.getByRole("button", { name: "Edit event" }).click();
  await page.getByRole("button", { name: "Only this date" }).click();
  const single = page.getByRole("dialog", { name: "Edit this date" });
  await single.getByLabel("Title").fill("Tandem Evening: Carnival");
  await single.getByRole("button", { name: "Save changes" }).click();
  await expect(heading(page, "Tandem Evening: Carnival")).toBeVisible();
  await page.reload();
  await expect(heading(page, "Tandem Evening: Carnival")).toBeVisible();
  await page.goto("/events/tandem-evening-2027-02-17");
  await expect(heading(page, "Tandem Evening")).toBeVisible();

  // Removing every date.
  await page.getByRole("button", { name: "Remove event" }).click();
  await page.getByRole("button", { name: "Remove all dates" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/events/tandem-evening-2027-03-03");
  await expect(page.getByRole("heading", { name: "We couldn't find that event" })).toBeVisible();
});
