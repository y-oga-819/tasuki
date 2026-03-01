/**
 * Store entry point — re-exports domain-specific stores.
 *
 * Import directly from the domain stores:
 *   import { useUiStore }      from "../store/uiStore";
 *   import { useDiffStore }    from "../store/diffStore";
 *   import { useDocStore }     from "../store/docStore";
 *   import { useEditorStore }  from "../store/editorStore";
 *   import { useReviewStore }  from "../store/reviewStore";
 */

import { useUiStore } from "./uiStore";
import { useDiffStore } from "./diffStore";
import { useDocStore } from "./docStore";
import { useEditorStore } from "./editorStore";
import { useReviewStore } from "./reviewStore";

export { useUiStore, useDiffStore, useDocStore, useEditorStore, useReviewStore };

// Re-export types previously exported from this module
export type { CommentFormTarget } from "./editorStore";
export type { DiffOverflow } from "./uiStore";

// Expose a combined proxy for e2e tests in development mode.
// E2E helpers call __zustandStore.getState().someAction(...).
if (import.meta.env.DEV && typeof window !== "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).__zustandStore = {
    getState: () => ({
      ...useUiStore.getState(),
      ...useDiffStore.getState(),
      ...useDocStore.getState(),
      ...useEditorStore.getState(),
      ...useReviewStore.getState(),
    }),
  };
}
