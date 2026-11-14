import type { Page } from "@playwright/test";

export const MOCK = "http://127.0.0.1:54321";
export const GATHERING_ID = "11111111-1111-4111-8111-111111111111";
export const HOST = { email: "host@e2e.test", password: "e2e-password-1" };

export async function mock<T = unknown>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${MOCK}/__mock/${path}`, { method: body === undefined ? "GET" : "POST", headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  return (await res.json()) as T;
}
export const resetMock = () => mock("reset", {});

export async function login(page: Page, creds = HOST) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(creds.email);
  await page.locator("#password").fill(creds.password);
  await page.getByRole("button", { name: /^(log in|sign in)$/i }).click();
}
