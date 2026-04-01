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
  await page.getByRole("heading", { level: 1 }).waitFor({ state: "visible" });
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
 * Add a review thread programmatically via the Zustand store.
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
      store.getState().addThread(filePath, {
        id: crypto.randomUUID(),
        file_path: filePath,
        line_start: lineStart,
        line_end: lineEnd,
        code_snippet: codeSnippet ?? "",
        body,
        type: "comment",
        created_at: Date.now(),
        author: "human",
      });
    },
    opts,
  );
}

/**
 * Expand a collapsed sidebar section by clicking its heading.
 */
export async function expandSidebarSection(
  page: Page,
  sectionName: string,
): Promise<void> {
  const heading = page.getByRole("heading", { level: 3 }).filter({ hasText: sectionName });
  await expect(heading).toBeVisible();
  await heading.click();
}

/**
 * Select a document from the sidebar, expanding the Documents section if needed.
 */
export async function selectDocumentFromSidebar(
  page: Page,
  docName: string,
): Promise<void> {
  const docItem = page.locator("li.file-item").filter({ hasText: docName });
  const isVisible = await docItem.first().isVisible().catch(() => false);
  if (!isVisible) {
    await expandSidebarSection(page, "Documents");
  }
  await expect(docItem.first()).toBeVisible();
  await docItem.first().click();
}
/**
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
  const textarea = page.getByPlaceholder("Write a review comment...");
  await expect(textarea).toBeVisible();
  await textarea.fill(body);

  const submitBtn = page.getByRole("button", { name: /Add Comment/ });
  await expect(submitBtn).toBeEnabled();
  await submitBtn.dispatchEvent("click");
}
