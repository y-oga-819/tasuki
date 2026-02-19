import { test as base, expect, type Page } from "@playwright/test";

/** Extended test fixture with clipboard permissions */
export const test = base.extend({
  context: async ({ browser }, use) => {
    const context = await browser.newContext({
      permissions: ["clipboard-read", "clipboard-write"],
    });
    await use(context);
    await context.close();
  },
  page: async ({ context }, use) => {
    const page = await context.newPage();
    await use(page);
  },
});

export { expect };

/** Wait for the app to finish loading (mock data rendered) */
export async function waitForAppReady(page: Page): Promise<void> {
  await page.locator("h1.toolbar-title").waitFor({ state: "visible" });
  await page
    .locator(".loading-spinner")
    .waitFor({ state: "hidden" })
    .catch(() => {});
}
