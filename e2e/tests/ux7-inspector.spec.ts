import { test, expect, waitForAppReady } from "../fixtures/setup";

test.describe("UX7: Code Inspector", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);
  });

  test("Inspector tab is visible in split mode right pane", async ({ page }) => {
    const inspectorTab = page.getByRole("tab", { name: "Inspector" });
    await expect(inspectorTab).toBeVisible();
  });

  test("clicking Inspector tab shows inspector panel", async ({ page }) => {
    const inspectorTab = page.getByRole("tab", { name: "Inspector" });
    await inspectorTab.click();
    await expect(inspectorTab).toHaveAttribute("aria-selected", "true");

    // The panel should be visible with method cards (mock data returns 5 methods)
    const panel = page.locator('[role="tabpanel"]');
    await expect(panel).toBeVisible();
  });

  test("method cards are displayed after analysis", async ({ page }) => {
    const inspectorTab = page.getByRole("tab", { name: "Inspector" });
    await inspectorTab.click();

    // Wait for mock analysis to complete and cards to appear
    const firstCard = page.locator('[class*="card"]').first();
    await expect(firstCard).toBeVisible({ timeout: 5000 });

    // Should show method name and change type badge
    await expect(page.getByText("handleLineSelect()")).toBeVisible();
    await expect(page.getByText("handleCommentSubmit()")).toBeVisible();
  });

  test("method cards show change type badges", async ({ page }) => {
    const inspectorTab = page.getByRole("tab", { name: "Inspector" });
    await inspectorTab.click();

    // Wait for cards
    await expect(page.getByText("handleLineSelect()")).toBeVisible({ timeout: 5000 });

    // All mock methods are "added" type
    const addedBadges = page.locator('[class*="changeAdded"]');
    expect(await addedBadges.count()).toBeGreaterThan(0);
  });

  test("clicking card header collapses/expands the card", async ({ page }) => {
    const inspectorTab = page.getByRole("tab", { name: "Inspector" });
    await inspectorTab.click();

    // Wait for cards
    await expect(page.getByText("handleLineSelect()")).toBeVisible({ timeout: 5000 });

    // Find the first card header and the section that should be visible
    const cardHeader = page.locator('[class*="cardHeader"]').first();
    const definitionSection = page.locator('[class*="sectionTitle"]').filter({ hasText: "Definition" }).first();

    // Initially expanded
    await expect(definitionSection).toBeVisible();

    // Click to collapse
    await cardHeader.click();
    await expect(definitionSection).not.toBeVisible();

    // Click again to expand
    await cardHeader.click();
    await expect(definitionSection).toBeVisible();
  });

  test("callers section shows caller entries", async ({ page }) => {
    const inspectorTab = page.getByRole("tab", { name: "Inspector" });
    await inspectorTab.click();

    // Wait for cards
    await expect(page.getByText("handleCommentSubmit()")).toBeVisible({ timeout: 5000 });

    // handleCommentSubmit has callers
    await expect(page.getByText("Callers").first()).toBeVisible();
    await expect(page.getByText("DiffViewer()").first()).toBeVisible();
  });

  test("callees section shows callee entries", async ({ page }) => {
    const inspectorTab = page.getByRole("tab", { name: "Inspector" });
    await inspectorTab.click();

    // Wait for cards
    await expect(page.getByText("handleCommentSubmit()")).toBeVisible({ timeout: 5000 });

    // handleCommentSubmit has callees (formatLineRange)
    await expect(page.getByText("Callees").first()).toBeVisible();
    await expect(page.getByText("formatLineRange()").first()).toBeVisible();
  });

  test("clicking a caller/callee opens code preview modal", async ({ page }) => {
    const inspectorTab = page.getByRole("tab", { name: "Inspector" });
    await inspectorTab.click();

    // Wait for cards to load
    await expect(page.getByText("handleCommentSubmit()")).toBeVisible({ timeout: 5000 });

    // Click on a callee item (formatLineRange in handleCommentSubmit's callees)
    const calleeItem = page.locator('[class*="callItemClickable"]').filter({ hasText: "formatLineRange()" }).first();
    await expect(calleeItem).toBeVisible();
    await calleeItem.click();

    // Modal should appear
    const modal = page.getByRole("dialog", { name: "Code preview" });
    await expect(modal).toBeVisible();

    // Modal should show function name and file path
    await expect(modal.getByText("formatLineRange()")).toBeVisible();
    await expect(modal.getByText("src/utils/format-helpers.ts")).toBeVisible();
  });

  test("code preview modal shows syntax-highlighted code", async ({ page }) => {
    const inspectorTab = page.getByRole("tab", { name: "Inspector" });
    await inspectorTab.click();

    await expect(page.getByText("handleCopyComment()")).toBeVisible({ timeout: 5000 });

    // Click on copyToClipboard callee
    const calleeItem = page.locator('[class*="callItemClickable"]').filter({ hasText: "copyToClipboard()" }).first();
    await calleeItem.click();

    const modal = page.getByRole("dialog", { name: "Code preview" });
    await expect(modal).toBeVisible();

    // Should contain code (Shiki renders into <pre><code> or <pre class="shiki">)
    const codeBlock = modal.locator("pre");
    await expect(codeBlock).toBeVisible({ timeout: 5000 });

    // The code should contain the function definition
    await expect(modal.getByText("copyToClipboard")).toBeVisible();
  });

  test("code preview modal highlights the target line", async ({ page }) => {
    const inspectorTab = page.getByRole("tab", { name: "Inspector" });
    await inspectorTab.click();

    await expect(page.getByText("handleCommentSubmit()")).toBeVisible({ timeout: 5000 });

    const calleeItem = page.locator('[class*="callItemClickable"]').filter({ hasText: "formatLineRange()" }).first();
    await calleeItem.click();

    const modal = page.getByRole("dialog", { name: "Code preview" });
    await expect(modal).toBeVisible();

    // Wait for code to load and highlight
    await expect(modal.locator("pre")).toBeVisible({ timeout: 5000 });

    // Check that a line is highlighted
    const highlightedLine = modal.locator('[data-highlight="true"]');
    await expect(highlightedLine).toBeVisible();
  });

  test("code preview modal closes on Escape", async ({ page }) => {
    const inspectorTab = page.getByRole("tab", { name: "Inspector" });
    await inspectorTab.click();

    await expect(page.getByText("handleCommentSubmit()")).toBeVisible({ timeout: 5000 });

    const calleeItem = page.locator('[class*="callItemClickable"]').filter({ hasText: "formatLineRange()" }).first();
    await calleeItem.click();

    const modal = page.getByRole("dialog", { name: "Code preview" });
    await expect(modal).toBeVisible();

    // Press Escape
    await page.keyboard.press("Escape");
    await expect(modal).not.toBeVisible();
  });

  test("code preview modal closes on backdrop click", async ({ page }) => {
    const inspectorTab = page.getByRole("tab", { name: "Inspector" });
    await inspectorTab.click();

    await expect(page.getByText("handleCommentSubmit()")).toBeVisible({ timeout: 5000 });

    const calleeItem = page.locator('[class*="callItemClickable"]').filter({ hasText: "formatLineRange()" }).first();
    await calleeItem.click();

    const modal = page.getByRole("dialog", { name: "Code preview" });
    await expect(modal).toBeVisible();

    // Click on the backdrop (the modal overlay itself, not the container)
    await modal.click({ position: { x: 10, y: 10 } });
    await expect(modal).not.toBeVisible();
  });

  test("method count is shown in header", async ({ page }) => {
    const inspectorTab = page.getByRole("tab", { name: "Inspector" });
    await inspectorTab.click();

    // Wait for analysis to complete
    await expect(page.getByText("handleLineSelect()")).toBeVisible({ timeout: 5000 });

    // Should show "5 methods" (mockInspectorResults has 5 entries)
    await expect(page.getByText("5 methods")).toBeVisible();
  });
});
