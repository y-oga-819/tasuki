import {
  test,
  expect,
  waitForAppReady,
  addCommentViaStore,
} from "../fixtures/setup";

test.describe("UX4: Copy All", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);
  });

  test("Copy All button exists and is initially disabled", async ({
    page,
  }) => {
    // Switch to Review tab in right pane
    const reviewTab = page.locator("button.right-pane-tab").filter({ hasText: "Review" });
    await reviewTab.click();

    const copyAllBtn = page.locator("button.copy-all-btn");
    await expect(copyAllBtn).toBeVisible();
    await expect(copyAllBtn).toHaveText("Copy All");
    await expect(copyAllBtn).toBeDisabled();
  });

  test("Copy All copies structured review prompt after adding comments", async ({
    page,
  }) => {
    await addCommentViaStore(page, {
      filePath: "src/components/DiffViewer.tsx",
      lineStart: 12,
      lineEnd: 12,
      body: "First comment",
      codeSnippet: "const x = 1;",
    });

    // Switch to Review tab in right pane
    const reviewTab = page.locator("button.right-pane-tab").filter({ hasText: "Review" });
    await reviewTab.click();

    await page
      .locator(".comment-body")
      .filter({ hasText: "First comment" })
      .waitFor();

    const copyAllBtn = page.locator("button.copy-all-btn");
    await expect(copyAllBtn).toBeEnabled();
    await copyAllBtn.click();

    const clipboardText = await page.evaluate(() =>
      navigator.clipboard.readText(),
    );
    expect(clipboardText).toContain("## Review Result:");
    expect(clipboardText).toContain("First comment");
  });
});
