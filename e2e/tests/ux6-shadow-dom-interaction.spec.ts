import { test, expect, waitForAppReady, openCommentForm } from "../fixtures/setup";

/**
 * UX6: Shadow DOM Direct Interaction
 *
 * Verify whether Playwright can interact directly with elements inside
 * Pierre's Shadow DOM — specifically hover, click, and pointer events —
 * potentially replacing the store-based workarounds in setup.ts.
 *
 * Current workarounds (setup.ts):
 *   - openCommentForm():   store dispatch instead of hover → click "+"
 *   - submitCommentForm(): Ctrl+Enter instead of clicking "Add Comment"
 *   - addCommentViaStore(): store dispatch instead of DOM interaction
 *
 * This test file probes each workaround to see if direct interaction works.
 */
test.describe("UX6: Shadow DOM Direct Interaction", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);
  });

  // =================================================================
  // Group A: Can Playwright trigger Pierre's hover utility?
  // =================================================================
  test.describe("hover → + button visibility", () => {
    test("hover() on a diff line shows the + button", async ({ page }) => {
      const diffLine = page.locator("[data-line]").first();
      await expect(diffLine).toBeVisible();

      // Playwright hover() should dispatch mouseover/pointerenter into Shadow DOM
      await diffLine.hover();

      const hoverBtn = page.locator(".dv-hover-comment-btn");
      await expect(hoverBtn).toBeVisible({ timeout: 3000 });
    });

    test("dispatchEvent pointerenter/mouseover shows the + button", async ({
      page,
    }) => {
      const diffLine = page.locator("[data-line]").first();
      await expect(diffLine).toBeVisible();

      // Manually fire the events Pierre might listen for
      await diffLine.dispatchEvent("pointerenter", { bubbles: true });
      await diffLine.dispatchEvent("mouseover", { bubbles: true });

      const hoverBtn = page.locator(".dv-hover-comment-btn");
      await expect(hoverBtn).toBeVisible({ timeout: 3000 });
    });

    test("hover on a specific addition line shows the + button", async ({
      page,
    }) => {
      // Target an addition line specifically (more realistic scenario)
      const additionLine = page
        .locator('[data-line][data-side="additions"]')
        .first();
      const lineExists = await additionLine
        .waitFor({ state: "visible", timeout: 3000 })
        .then(() => true)
        .catch(() => false);

      if (!lineExists) {
        // Fall back to any data-line if no additions side attribute
        const anyLine = page.locator("[data-line]").first();
        await expect(anyLine).toBeVisible();
        await anyLine.hover();
      } else {
        await additionLine.hover();
      }

      const hoverBtn = page.locator(".dv-hover-comment-btn");
      await expect(hoverBtn).toBeVisible({ timeout: 3000 });
    });
  });

  // =================================================================
  // Group B: Can Playwright click the + button to open the form?
  // =================================================================
  test.describe("+ button → comment form", () => {
    test("clicking + button via pointerdown opens the form", async ({
      page,
    }) => {
      const diffLine = page.locator("[data-line]").first();
      await expect(diffLine).toBeVisible();
      await diffLine.hover();

      const hoverBtn = page.locator(".dv-hover-comment-btn");
      await expect(hoverBtn).toBeVisible({ timeout: 3000 });

      // The button uses onPointerDown, so dispatch that event
      await hoverBtn.dispatchEvent("pointerdown");

      const textarea = page.locator("textarea.dv-form-textarea");
      await expect(textarea).toBeVisible({ timeout: 3000 });
    });

    test("clicking + button via click() opens the form", async ({ page }) => {
      const diffLine = page.locator("[data-line]").first();
      await expect(diffLine).toBeVisible();
      await diffLine.hover();

      const hoverBtn = page.locator(".dv-hover-comment-btn");
      await expect(hoverBtn).toBeVisible({ timeout: 3000 });

      // Standard click — triggers mousedown + mouseup + click
      await hoverBtn.click();

      const textarea = page.locator("textarea.dv-form-textarea");
      await expect(textarea).toBeVisible({ timeout: 3000 });
    });
  });

  // =================================================================
  // Group C: Can Playwright click the "Add Comment" submit button?
  // (Uses store to open form, isolating only the submit interaction)
  // =================================================================
  test.describe("submit button click", () => {
    test("click() on Add Comment button submits the comment", async ({
      page,
    }) => {
      // Open form via known-working store method to isolate submit test
      await openCommentForm(page, "src/components/DiffViewer.tsx", 12);

      const textarea = page.locator("textarea.dv-form-textarea");
      await expect(textarea).toBeVisible();
      await textarea.fill("Testing direct click submit");

      const submitBtn = page.locator("button.btn-primary", {
        hasText: "Add Comment",
      });
      await expect(submitBtn).toBeEnabled();
      await submitBtn.click();

      // Verify comment appeared in review panel (outside Shadow DOM)
      const commentBody = page
        .locator(".comment-body")
        .filter({ hasText: "Testing direct click submit" });
      await expect(commentBody).toBeVisible({ timeout: 3000 });
    });

    test("dispatchEvent click on Add Comment button submits", async ({
      page,
    }) => {
      await openCommentForm(page, "src/components/DiffViewer.tsx", 12);

      const textarea = page.locator("textarea.dv-form-textarea");
      await expect(textarea).toBeVisible();
      await textarea.fill("Testing dispatchEvent submit");

      const submitBtn = page.locator("button.btn-primary", {
        hasText: "Add Comment",
      });
      await expect(submitBtn).toBeEnabled();
      await submitBtn.dispatchEvent("click");

      const commentBody = page
        .locator(".comment-body")
        .filter({ hasText: "Testing dispatchEvent submit" });
      await expect(commentBody).toBeVisible({ timeout: 3000 });
    });
  });

  // =================================================================
  // Group D: Full end-to-end flow without any store workarounds
  // =================================================================
  test.describe("full flow (no store workarounds)", () => {
    test("hover → + button → fill form → submit → review panel", async ({
      page,
    }) => {
      // Step 1: Hover a diff line to show "+" button
      const diffLine = page.locator("[data-line]").first();
      await expect(diffLine).toBeVisible();
      await diffLine.hover();

      // Step 2: Click "+" button to open comment form
      const hoverBtn = page.locator(".dv-hover-comment-btn");
      await expect(hoverBtn).toBeVisible({ timeout: 3000 });
      await hoverBtn.dispatchEvent("pointerdown");

      // Step 3: Fill and submit the form
      const textarea = page.locator("textarea.dv-form-textarea");
      await expect(textarea).toBeVisible({ timeout: 3000 });
      await textarea.fill("Full flow test comment");

      const submitBtn = page.locator("button.btn-primary", {
        hasText: "Add Comment",
      });
      await submitBtn.click();

      // Step 4: Verify in review panel
      const commentBody = page
        .locator(".comment-body")
        .filter({ hasText: "Full flow test comment" });
      await expect(commentBody).toBeVisible({ timeout: 3000 });
    });

    test("hover → + button → fill form → Ctrl+Enter → review panel", async ({
      page,
    }) => {
      // Same flow but using keyboard shortcut to submit (current workaround)
      const diffLine = page.locator("[data-line]").first();
      await expect(diffLine).toBeVisible();
      await diffLine.hover();

      const hoverBtn = page.locator(".dv-hover-comment-btn");
      await expect(hoverBtn).toBeVisible({ timeout: 3000 });
      await hoverBtn.dispatchEvent("pointerdown");

      const textarea = page.locator("textarea.dv-form-textarea");
      await expect(textarea).toBeVisible({ timeout: 3000 });
      await textarea.fill("Keyboard submit test");
      await textarea.press("Control+Enter");

      const commentBody = page
        .locator(".comment-body")
        .filter({ hasText: "Keyboard submit test" });
      await expect(commentBody).toBeVisible({ timeout: 3000 });
    });
  });
});
