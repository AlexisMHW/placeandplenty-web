import { test, expect } from "@playwright/test";
import { GATHERING_ID, login, mock, resetMock } from "./helpers";

test.beforeEach(async () => { await resetMock(); });

test("logged-out visitors are sent to /login for host, command-center and creator", async ({ page }) => {
  for (const path of ["/host", `/host/g/${GATHERING_ID}/shopping`, "/command-center", "/creator"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login/);
  }
});

test("private areas are never cached and are noindex", async ({ page, request }) => {
  await login(page);
  await expect(page).toHaveURL(/\/host/);
  for (const path of ["/command-center", "/creator"]) {
    const res = await page.request.get(path, { maxRedirects: 0 });
    expect(res.headers()["cache-control"] ?? "").toMatch(/no-store/);
  }
  const robots = await request.get("/robots.txt");
  const text = await robots.text();
  expect(text).toContain("/command-center/");
  expect(text).toContain("/creator/");
});

test("password login reaches the host area; wrong password does not", async ({ page }) => {
  await login(page, { email: "host@e2e.test", password: "wrong" });
  await expect(page).not.toHaveURL(/\/host/);
  await login(page);
  await expect(page).toHaveURL(/\/host/);
});

test("no analytics script is requested with analytics mode off", async ({ page }) => {
  const hosts: string[] = [];
  page.on("request", (r) => hosts.push(new URL(r.url()).hostname));
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  expect(hosts.filter((h) => /googletagmanager|google-analytics|posthog/.test(h))).toEqual([]);
  expect(await mock<unknown[]>("unhandled")).toBeDefined();
});
