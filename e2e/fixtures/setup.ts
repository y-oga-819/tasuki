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

/**
 * Open the inline comment form on a specific file/line via the Zustand store.
 *
 * Pierre's diff rendering uses Shadow DOM, so the hover-button interaction
 * cannot be triggered through Playwright's standard hover().  Instead we
 * programmatically call `setCommentFormTarget` which opens the form directly.
 */
export async function openCommentForm(
  page: Page,
  filePath: string,
  lineNumber: number,
  side: "additions" | "deletions" = "additions",
): Promise<void> {
  await page.evaluate(
    ({ filePath, lineNumber, side }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const store = (window as any).__zustandStore;
      if (!store) throw new Error("Zustand store not exposed on window");
      store.getState().setCommentFormTarget({
        filePath,
        lineNumber,
        side,
        selectionStart: lineNumber,
        selectionEnd: lineNumber,
      });
    },
    { filePath, lineNumber, side },
  );
}

/**
 * Add a review comment programmatically via the Zustand store.
 */
export async function addCommentViaStore(
  page: Page,
  opts: {
    filePath: string;
    lineStart: number;
    lineEnd: number;
    body: string;
    codeSnippet?: string;
  },
): Promise<void> {
  await page.evaluate(
    ({ filePath, lineStart, lineEnd, body, codeSnippet }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const store = (window as any).__zustandStore;
      if (!store) throw new Error("Zustand store not exposed on window");
      store.getState().addComment({
        id: crypto.randomUUID(),
        file_path: filePath,
        line_start: lineStart,
        line_end: lineEnd,
        code_snippet: codeSnippet ?? "",
        body,
        type: "comment",
        created_at: Date.now(),
        parent_id: null,
        author: "human",
        resolved: false,
        resolved_at: null,
        resolution_memo: null,
      });
    },
    opts,
  );
}

/**
 * Submit a comment using the inline form (after opening it via openCommentForm).
 * Fills the textarea and clicks the "Add Comment" button via dispatchEvent.
 *
 * Pierre's <diffs-container> Shadow DOM intercepts pointer events, so
 * Playwright's native click() is blocked.  Using dispatchEvent("click")
 * bypasses the pointer-event interception and fires the button's handler
 * directly — a more realistic interaction than the Ctrl+Enter shortcut.
 */
export async function submitCommentForm(
  page: Page,
  body: string,
): Promise<void> {
  const textarea = page.locator("textarea.dv-form-textarea");
  await expect(textarea).toBeVisible();
  await textarea.fill(body);

  const submitBtn = page.locator("button.btn-primary", {
    hasText: "Add Comment",
  });
  await expect(submitBtn).toBeEnabled();
  await submitBtn.dispatchEvent("click");
}
