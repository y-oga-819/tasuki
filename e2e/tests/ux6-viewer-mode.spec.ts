import { test, expect, waitForAppReady } from "../fixtures/setup";

test.describe("UX6: Viewer Mode & Mermaid Zoom", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);
  });

  test("clicking Viewer tab switches to viewer layout", async ({ page }) => {
    const viewerTab = page.getByRole("tab", { name: "Viewer" });
    await expect(viewerTab).toBeVisible();
    await viewerTab.click();
    await expect(viewerTab).toHaveAttribute("aria-selected", "true");

    // Viewer layout should show the resizable pane (markdown left, terminal right)
    const viewerLayout = page.getByRole("main", { name: "Viewer" });
    await expect(viewerLayout).toBeVisible();

    // Markdown viewer should be visible in the left pane
    const markdownViewer = page.getByRole("article", { name: "Document" });
    await expect(markdownViewer).toBeVisible();
  });

  test("viewer mode hides diff-specific controls in toolbar", async ({ page }) => {
    const viewerTab = page.getByRole("tab", { name: "Viewer" });
    await viewerTab.click();

    // Diff layout buttons (Split/Unified) should not be visible
    const splitBtn = page.locator("button.layout-btn").filter({ hasText: "Split" });
    await expect(splitBtn).toBeHidden();

    const unifiedBtn = page.locator("button.layout-btn").filter({ hasText: "Unified" });
    await expect(unifiedBtn).toBeHidden();

    // Stats should not be visible
    const stats = page.locator('[aria-label="Diff statistics"]');
    await expect(stats).toBeHidden();
  });

  test("viewer mode hides Changed Files in sidebar", async ({ page }) => {
    // In default split mode, Changed Files section should be visible
    const changedSection = page.getByRole("heading", { level: 3 }).filter({ hasText: "Changed Files" });
    await expect(changedSection).toBeVisible();

    // Switch to viewer
    const viewerTab = page.getByRole("tab", { name: "Viewer" });
    await viewerTab.click();

    // Changed Files should be hidden in viewer mode
    await expect(changedSection).toBeHidden();
  });

  test("viewer mode shows Add Folder button in sidebar", async ({ page }) => {
    const viewerTab = page.getByRole("tab", { name: "Viewer" });
    await viewerTab.click();

    const addFolderBtn = page.getByRole("button", { name: "Add Folder" });
    await expect(addFolderBtn).toBeVisible();
  });

  test("viewer mode shows Documents section in sidebar", async ({ page }) => {
    const viewerTab = page.getByRole("tab", { name: "Viewer" });
    await viewerTab.click();

    const docsSection = page.getByRole("heading", { level: 3 }).filter({ hasText: "Documents" });
    await expect(docsSection).toBeVisible();
  });

  test("selecting a document in viewer mode shows content in left pane", async ({ page }) => {
    const viewerTab = page.getByRole("tab", { name: "Viewer" });
    await viewerTab.click();

    const docItem = page.locator("li.file-item").filter({ hasText: "architecture" });
    await expect(docItem.first()).toBeVisible();
    await docItem.first().click();

    const markdownViewer = page.getByRole("article", { name: "Document" });
    await expect(markdownViewer).toBeVisible();
  });

  test("Mermaid zoom button opens modal and can be closed", async ({ page }) => {
    // Ensure we have a rendered mermaid diagram (in split mode docs pane)
    const markdownViewer = page.getByRole("article", { name: "Document" });
    await expect(markdownViewer).toBeVisible();

    const mermaidBlock = page.getByRole("figure", { name: "Mermaid diagram" }).first();
    const mermaidVisible = await mermaidBlock.isVisible().catch(() => false);

    if (!mermaidVisible) {
      test.skip();
      return;
    }

    // Wait for SVG rendering (use role="img" to target Mermaid SVG, not icon SVGs)
    const svg = mermaidBlock.getByRole("img");
    await expect(svg).toBeVisible({ timeout: 10000 });

    // Hover block to reveal zoom button (opacity: 0 by default)
    await mermaidBlock.hover();
    const zoomBtn = page.getByTitle("Zoom diagram").first();
    await zoomBtn.click();

    // Modal should appear
    const modal = page.getByRole("dialog", { name: "Diagram zoom" });
    await expect(modal).toBeVisible();

    // Zoom controls should be present
    await expect(page.getByTitle("Zoom in")).toBeVisible();
    await expect(page.getByTitle("Zoom out")).toBeVisible();

    // Should show 100% by default
    const level = page.getByTitle("Reset zoom");
    await expect(level).toHaveText("100%");

    // Close button should exist
    await expect(page.getByTitle("Close (Escape)")).toBeVisible();

    // Close via Escape
    await page.keyboard.press("Escape");
    await expect(modal).toBeHidden();
  });

  test("Mermaid zoom controls work correctly", async ({ page }) => {
    const markdownViewer = page.getByRole("article", { name: "Document" });
    await expect(markdownViewer).toBeVisible();

    const mermaidBlock = page.getByRole("figure", { name: "Mermaid diagram" }).first();
    const mermaidVisible = await mermaidBlock.isVisible().catch(() => false);

    if (!mermaidVisible) {
      test.skip();
      return;
    }

    const svg = mermaidBlock.getByRole("img");
    await expect(svg).toBeVisible({ timeout: 10000 });

    // Hover block to reveal zoom button (opacity: 0 by default), then open modal
    await mermaidBlock.hover();
    const zoomBtn = page.getByTitle("Zoom diagram").first();
    await zoomBtn.click();

    const modal = page.getByRole("dialog", { name: "Diagram zoom" });
    await expect(modal).toBeVisible();

    const level = page.getByTitle("Reset zoom");
    await expect(level).toHaveText("100%");

    // Click zoom in (+)
    await page.getByTitle("Zoom in").click();
    // Should be more than 100% after zoom in
    const afterZoomIn = await level.textContent();
    expect(parseInt(afterZoomIn || "0")).toBeGreaterThan(100);

    // Click reset (click on the percentage text)
    await level.click();
    await expect(level).toHaveText("100%");

    // Click zoom out (-)
    await page.getByTitle("Zoom out").click();
    const afterZoomOut = await level.textContent();
    expect(parseInt(afterZoomOut || "0")).toBeLessThan(100);

    // Close via close button
    await page.getByTitle("Close (Escape)").click();
    await expect(modal).toBeHidden();
  });
});
