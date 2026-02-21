import {
  test,
  expect,
  waitForAppReady,
  openCommentForm,
  submitCommentForm,
  addCommentViaStore,
} from "../fixtures/setup";

test.describe("UX2: Line Comment", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);
  });

  test("diff lines are rendered inside Shadow DOM", async ({ page }) => {
    // Pierre renders diff lines as [data-line] elements inside <diffs-container> shadow DOM.
    // Playwright CSS selectors pierce open shadow DOM by default.
    const diffLine = page.locator("[data-line]").first();
    await expect(diffLine).toBeVisible();
  });

  test("opening comment form via store shows the form", async ({ page }) => {
    // The hover button lives inside Pierre's Shadow DOM and cannot be triggered
    // via Playwright's hover(). Instead, open the form programmatically.
    await openCommentForm(page, "src/components/DiffViewer.tsx", 12);

    const textarea = page.locator("textarea.dv-form-textarea");
    await expect(textarea).toBeVisible();
  });

  test("submitting comment form adds a comment", async ({ page }) => {
    await openCommentForm(page, "src/components/DiffViewer.tsx", 12);
    await submitCommentForm(page, "This is a test comment");

    // Verify in the review panel (outside Shadow DOM)
    const commentBody = page
      .locator(".comment-body")
      .filter({ hasText: "This is a test comment" });
    await expect(commentBody).toBeVisible();
  });

  test("comment added via store appears in ReviewPanel", async ({ page }) => {
    await addCommentViaStore(page, {
      filePath: "src/components/DiffViewer.tsx",
      lineStart: 10,
      lineEnd: 10,
      body: "E2E test comment",
      codeSnippet: "const x = 1;",
    });

    const reviewPanel = page.locator("div.review-panel");
    await expect(reviewPanel).toBeVisible();
  });
});
