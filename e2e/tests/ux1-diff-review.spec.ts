import { test, expect, waitForAppReady } from "../fixtures/setup";

test.describe("UX1: Diff Review", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);
  });

  test("displays mock diff data on load", async ({ page }) => {
    const diffContainers = page.locator("[data-file-path]");
    await expect(diffContainers.first()).toBeVisible();
    expect(await diffContainers.count()).toBeGreaterThan(0);
  });

  test("shows changed files in sidebar", async ({ page }) => {
    const fileItems = page.locator("li.file-item");
    await expect(fileItems.first()).toBeVisible();

    // Mock data has at least 4 files: modified, added, deleted, renamed
    const count = await fileItems.count();
    expect(count).toBeGreaterThanOrEqual(4);
  });

  test("clicking a file scrolls to its diff", async ({ page }) => {
    const fileItem = page.locator("li.file-item:not(.tree-dir)").first();
    await fileItem.click();

    await expect(fileItem).toHaveClass(/selected/);

    const diffSection = page.locator("[data-file-path]").first();
    await expect(diffSection).toBeVisible();
  });

  test("split/unified toggle switches diff layout", async ({ page }) => {
    const unifiedBtn = page.locator('button.layout-btn[title="Unified view (stacked)"]');
    await unifiedBtn.click();
    await expect(unifiedBtn).toHaveClass(/active/);

    const splitBtn = page.locator('button.layout-btn[title="Split view (side-by-side)"]');
    await splitBtn.click();
    await expect(splitBtn).toHaveClass(/active/);
  });
});
