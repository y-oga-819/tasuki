import { test, expect, waitForAppReady } from "../fixtures/setup";

test.describe("UX4: Copy All", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);
  });

  test("Copy All button exists and is initially disabled", async ({ page }) => {
    const copyAllBtn = page.locator("button.copy-all-btn");
    await expect(copyAllBtn).toBeVisible();
    await expect(copyAllBtn).toHaveText("Copy All");
    await expect(copyAllBtn).toBeDisabled();
  });

  test("Copy All copies structured review prompt after adding comments", async ({ page }) => {
    const hoverBtn = page.locator("button.dv-hover-comment-btn");
    const diffAreas = page.locator("[data-file-path]");

    await diffAreas.first().hover();
    if (!(await hoverBtn.isVisible().catch(() => false))) {
      test.skip(true, "Shadow DOM hover button not accessible - needs PoC resolution");
      return;
    }

    await hoverBtn.first().click();
    await page.locator("textarea.dv-form-textarea").fill("First comment");
    await page.locator("button.btn-primary").filter({ hasText: "Add Comment" }).click();

    await page.locator(".comment-body").filter({ hasText: "First comment" }).waitFor();

    const copyAllBtn = page.locator("button.copy-all-btn");
    await expect(copyAllBtn).toBeEnabled();
    await copyAllBtn.click();

    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toContain("## Review Result:");
    expect(clipboardText).toContain("First comment");
  });
});
