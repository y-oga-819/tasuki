import {
  test,
  expect,
  waitForAppReady,
  addCommentViaStore,
} from "../fixtures/setup";

test.describe("UX3: Copy Comment", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);
  });

  test("copy button copies individual comment to clipboard", async ({
    page,
  }) => {
    await addCommentViaStore(page, {
      filePath: "src/components/DiffViewer.tsx",
      lineStart: 12,
      lineEnd: 12,
      body: "Review: extract this to a constant",
      codeSnippet: "const x = 1;",
    });

    // Switch to Review tab in right pane
    const reviewTab = page.locator("button.right-pane-tab").filter({ hasText: "Review" });
    await reviewTab.click();

    const copyBtn = page
      .locator('button.btn-icon[title="Copy this comment"]')
      .first();
    await expect(copyBtn).toBeVisible();
    await copyBtn.click();

    const clipboardText = await page.evaluate(() =>
      navigator.clipboard.readText(),
    );
    expect(clipboardText).toContain("Review: extract this to a constant");
  });

  test("copied content follows the expected format", async ({ page }) => {
    await addCommentViaStore(page, {
      filePath: "src/components/DiffViewer.tsx",
      lineStart: 10,
      lineEnd: 10,
      body: "Needs refactoring",
      codeSnippet: "const x = 1;",
    });

    // Switch to Review tab in right pane
    const reviewTab = page.locator("button.right-pane-tab").filter({ hasText: "Review" });
    await reviewTab.click();

    const copyBtn = page
      .locator('button.btn-icon[title="Copy this comment"]')
      .first();
    await expect(copyBtn).toBeVisible();
    await copyBtn.click();

    // Format: {file}:L{line}\n> {snippet}\n{body}
    const clipboardText = await page.evaluate(() =>
      navigator.clipboard.readText(),
    );
    expect(clipboardText).toContain(":L");
    expect(clipboardText).toContain("Needs refactoring");
  });
});
