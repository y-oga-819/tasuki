import { test, expect, waitForAppReady } from "../fixtures/setup";

/** Helper to scope queries to the Inspector panel (right pane tabpanel). */
function inspectorPanel(page: import("@playwright/test").Page) {
  return page.locator('[role="tabpanel"][id="panel-inspector"]');
}

/** Click the Inspector tab and wait for method cards to load. */
async function openInspectorWithCards(page: import("@playwright/test").Page) {
  const inspectorTab = page.getByRole("tab", { name: "Inspector" });
  await inspectorTab.click();
  // Wait for mock analysis to complete — method names appear in cards
  const panel = inspectorPanel(page);
  await expect(panel.locator('[class*="methodName"]').first()).toBeVisible({ timeout: 5000 });
}

test.describe("UX7: Code Inspector", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);
  });

  test("Inspector tab is visible in split mode right pane", async ({ page }) => {
    const inspectorTab = page.getByRole("tab", { name: "Inspector" });
    await expect(inspectorTab).toBeVisible();
  });

  test("clicking Inspector tab shows inspector panel with tabpanel", async ({ page }) => {
    const inspectorTab = page.getByRole("tab", { name: "Inspector" });
    await inspectorTab.click();
    await expect(inspectorTab).toHaveAttribute("aria-selected", "true");

    const panel = inspectorPanel(page);
    await expect(panel).toBeVisible();
  });

  test("method cards are displayed after analysis", async ({ page }) => {
    await openInspectorWithCards(page);
    const panel = inspectorPanel(page);

    // Should show method names from mock data
    await expect(panel.locator('[class*="methodName"]')).toHaveCount(5);
  });

  test("method cards show change type badges", async ({ page }) => {
    await openInspectorWithCards(page);
    const panel = inspectorPanel(page);

    // All mock methods are "added" type
    const addedBadges = panel.locator('[class*="changeAdded"]');
    expect(await addedBadges.count()).toBeGreaterThan(0);
  });

  test("clicking card header collapses/expands the card", async ({ page }) => {
    await openInspectorWithCards(page);
    const panel = inspectorPanel(page);

    const cardHeader = panel.locator('[class*="cardHeader"]').first();
    const definitionSection = panel.locator('[class*="sectionTitle"]').filter({ hasText: "Definition" }).first();

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
    await openInspectorWithCards(page);
    const panel = inspectorPanel(page);

    // At least one card has callers
    await expect(panel.locator('[class*="sectionTitle"]').filter({ hasText: "Callers" }).first()).toBeVisible();
    // DiffViewer is a caller of handleLineSelect
    await expect(panel.locator('[class*="callName"]').filter({ hasText: "DiffViewer()" }).first()).toBeVisible();
  });

  test("callees section shows callee entries", async ({ page }) => {
    await openInspectorWithCards(page);
    const panel = inspectorPanel(page);

    // handleCommentSubmit has callees (formatLineRange)
    await expect(panel.locator('[class*="sectionTitle"]').filter({ hasText: "Callees" }).first()).toBeVisible();
    await expect(panel.locator('[class*="callName"]').filter({ hasText: "formatLineRange()" }).first()).toBeVisible();
  });

  test("clicking a caller/callee opens code preview modal", async ({ page }) => {
    await openInspectorWithCards(page);
    const panel = inspectorPanel(page);

    // Click on a callee item (formatLineRange)
    const calleeItem = panel.locator('[class*="callItemClickable"]').filter({ hasText: "formatLineRange()" }).first();
    await expect(calleeItem).toBeVisible();
    await calleeItem.click();

    // Modal should appear (it's rendered at the page level, not inside the panel)
    const modal = page.getByRole("dialog", { name: "Code preview" });
    await expect(modal).toBeVisible();

    // Modal should show function name and file path in the header
    await expect(modal.locator('[class*="funcName"]')).toContainText("formatLineRange()");
    await expect(modal.locator('[class*="location"]')).toContainText("format-helpers.ts");
  });

  test("code preview modal shows code with pre block", async ({ page }) => {
    await openInspectorWithCards(page);
    const panel = inspectorPanel(page);

    // Click on copyToClipboard callee (inside handleCopyComment card)
    const calleeItem = panel.locator('[class*="callItemClickable"]').filter({ hasText: "copyToClipboard()" }).first();
    await calleeItem.click();

    const modal = page.getByRole("dialog", { name: "Code preview" });
    await expect(modal).toBeVisible();

    // Should contain a <pre> block with code
    const codeBlock = modal.locator("pre");
    await expect(codeBlock).toBeVisible({ timeout: 5000 });
  });

  test("code preview modal highlights the target line", async ({ page }) => {
    await openInspectorWithCards(page);
    const panel = inspectorPanel(page);

    const calleeItem = panel.locator('[class*="callItemClickable"]').filter({ hasText: "formatLineRange()" }).first();
    await calleeItem.click();

    const modal = page.getByRole("dialog", { name: "Code preview" });
    await expect(modal).toBeVisible();

    // Wait for code to load
    await expect(modal.locator("pre")).toBeVisible({ timeout: 5000 });

    // Check that a line is highlighted
    const highlightedLine = modal.locator('[data-highlight="true"]');
    await expect(highlightedLine).toBeVisible();
  });

  test("code preview modal closes on Escape", async ({ page }) => {
    await openInspectorWithCards(page);
    const panel = inspectorPanel(page);

    const calleeItem = panel.locator('[class*="callItemClickable"]').filter({ hasText: "formatLineRange()" }).first();
    await calleeItem.click();

    const modal = page.getByRole("dialog", { name: "Code preview" });
    await expect(modal).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(modal).not.toBeVisible();
  });

  test("code preview modal closes on backdrop click", async ({ page }) => {
    await openInspectorWithCards(page);
    const panel = inspectorPanel(page);

    const calleeItem = panel.locator('[class*="callItemClickable"]').filter({ hasText: "formatLineRange()" }).first();
    await calleeItem.click();

    const modal = page.getByRole("dialog", { name: "Code preview" });
    await expect(modal).toBeVisible();

    // Click on the backdrop (top-left corner of the modal overlay)
    await modal.click({ position: { x: 5, y: 5 } });
    await expect(modal).not.toBeVisible();
  });

  test("method count is shown in header", async ({ page }) => {
    await openInspectorWithCards(page);
    const panel = inspectorPanel(page);

    // Should show "5 methods" (mockInspectorResults has 5 entries)
    await expect(panel.locator('[class*="progressInfo"]')).toContainText("5 method");
  });
});
