import { test, expect } from "@playwright/test";
import { GATHERING_ID, login, mock, resetMock } from "./helpers";

const url = `/host/g/${GATHERING_ID}/shopping`;
type Rpc = { name: string }[];

// The add form is collapsed behind an "Add to the list" button until opened.
async function openAddForm(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: /add to the list/i }).first().click();
}

test.beforeEach(async () => { await resetMock(); });

test("shopping: host sees the list and can add an item on an active gathering", async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL(/\/host/);
  await page.goto(url);
  await expect(page.getByText("Butter", { exact: true })).toBeVisible();
  await openAddForm(page);
  await page.getByPlaceholder("Ice").fill("Sparkling cider");
  await page.getByRole("button", { name: "Add item" }).click();
  await expect.poll(async () => (await mock<Rpc>("rpc")).filter((r) => r.name === "shopping_add_item").length).toBe(1);
  const db = await mock<{ shopping_items: { name: string }[] }>("db");
  expect(db.shopping_items.map((i) => i.name)).toContain("Sparkling cider");
});

test("shopping: a finished gathering refuses the add with a visible message and writes nothing (D2)", async ({ page }) => {
  await mock("set-status", { status: "completed" });
  await login(page);
  await expect(page).toHaveURL(/\/host/);
  await page.goto(url);
  await openAddForm(page);
  await page.getByPlaceholder("Ice").fill("Should not save");
  await page.getByRole("button", { name: "Add item" }).click();
  await expect(page.getByText(/finished or archived, so it can.t be changed/i)).toBeVisible();
  const rpc = await mock<Rpc>("rpc");
  expect(rpc.filter((r) => r.name === "shopping_add_item")).toHaveLength(0);
  const db = await mock<{ shopping_items: { name: string }[] }>("db");
  expect(db.shopping_items.map((i) => i.name)).not.toContain("Should not save");
});

test("shopping: an unreadable status fails closed", async ({ page }) => {
  await mock("rpc-override", { name: "effective_gathering_status", value: null });
  await login(page);
  await page.goto(url);
  await openAddForm(page);
  await page.getByPlaceholder("Ice").fill("Should not save either");
  await page.getByRole("button", { name: "Add item" }).click();
  await expect(page.getByText(/couldn.t confirm this gathering.s status/i)).toBeVisible();
  expect((await mock<Rpc>("rpc")).filter((r) => r.name === "shopping_add_item")).toHaveLength(0);
});
