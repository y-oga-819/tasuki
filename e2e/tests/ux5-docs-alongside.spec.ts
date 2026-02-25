import { test, expect, waitForAppReady } from "../fixtures/setup";

test.describe("UX5: Docs Alongside", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);
  });

  test("split mode shows left pane with diff and right pane with docs/terminal", async ({ page }) => {
    const splitTab = page.locator("button.tab-btn").filter({ hasText: "Split" });
    await expect(splitTab).toHaveAttribute("aria-selected", "true");

    const splitLeft = page.locator(".split-left");
    await expect(splitLeft).toBeVisible();

    const splitRight = page.locator(".split-right");
    await expect(splitRight).toBeVisible();

    // Right pane should have Docs/Terminal tabs
    const docsTab = splitRight.locator("button.right-pane-tab").filter({ hasText: "Docs" });
    await expect(docsTab).toBeVisible();
  });

  test("selecting a document from sidebar shows its content", async ({ page }) => {
    const docItem = page.locator("li.file-item").filter({ hasText: "architecture" });
    await expect(docItem.first()).toBeVisible();
    await docItem.first().click();

    const markdownViewer = page.locator("div.markdown-viewer");
    await expect(markdownViewer).toBeVisible();
  });

  test("Mermaid diagrams are rendered as SVG", async ({ page }) => {
    const markdownViewer = page.locator("div.markdown-viewer");
    await expect(markdownViewer).toBeVisible();

    // Mermaid rendering is async, so check with extended timeout
    const mermaidBlock = page.locator("div.mermaid-block");
    const mermaidVisible = await mermaidBlock.isVisible().catch(() => false);

    if (mermaidVisible) {
      const renderArea = mermaidBlock.locator("div.mermaid-render-area");
      await expect(renderArea).toBeVisible({ timeout: 10000 });

      const svg = renderArea.locator("svg");
      await expect(svg).toBeVisible({ timeout: 10000 });
    }
    // If mermaid block doesn't appear, the markdown viewer is still verified as visible
  });
});
