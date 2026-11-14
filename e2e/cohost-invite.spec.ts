import { test, expect } from "@playwright/test";
import { GATHERING_ID, login, mock, resetMock } from "./helpers";

const url = `/host/g/${GATHERING_ID}/co-hosts`;
type Rpc = { name: string; args: Record<string, unknown> }[];

test.beforeEach(async () => { await resetMock(); });

test("co-host: host creates an invitation and is shown a one-time link", async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL(/\/host/);
  await page.goto(url);
  await page.getByPlaceholder("them@example.com").fill("Friend@Example.com");
  await page.getByRole("button", { name: "Create invitation" }).click();
  await expect(page.getByText(/Send this to friend@example\.com/i)).toBeVisible();
  await expect(page.getByText(/\/host\/co-host-invite\/e2e-token-friend/)).toBeVisible();
  const call = (await mock<Rpc>("rpc")).find((r) => r.name === "create_gathering_invitation");
  expect(call?.args.p_invited_email).toBe("friend@example.com"); // normalised to lowercase
});

test("co-host: a malformed address is refused before any server call", async ({ page }) => {
  await login(page);
  await page.goto(url);
  const input = page.getByPlaceholder("them@example.com");
  await input.fill("not-an-email");
  await page.getByRole("button", { name: "Create invitation" }).click();
  expect((await mock<Rpc>("rpc")).filter((r) => r.name === "create_gathering_invitation")).toHaveLength(0);
});

// D2: on a finished gathering the page does not offer the invite form at all.
// The SERVER-SIDE refusal for a direct call to inviteCoHost is NOT in place yet: host-actions.ts is
// owned by the invitation workstream and the guard ships as
// reports/patches/host-actions-readonly-guard.patch (see REQUESTS.md). The browser cannot exercise
// that path because the form is absent, so it is covered by tests/gathering-write-guard.test.ts once
// the patch is applied.
test("co-host: a finished gathering offers no invite form (D2, UI level)", async ({ page }) => {
  await mock("set-status", { status: "completed" });
  await login(page);
  await page.goto(url);
  await expect(page.locator("h1").first()).toBeVisible();
  await expect(page.getByPlaceholder("them@example.com")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Create invitation" })).toHaveCount(0);
});
