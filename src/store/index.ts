/**
 * Store entry point — re-exports domain-specific stores.
 *
 * Import directly from the domain stores:
 *   import { useDisplayStore } from "../store/displayStore";
 *   import { useDiffStore }    from "../store/diffStore";
 *   import { useReviewStore }  from "../store/reviewStore";
 */

import { useDisplayStore } from "./displayStore";
import { useDiffStore } from "./diffStore";
import { useReviewStore } from "./reviewStore";

export { useDisplayStore, useDiffStore, useReviewStore };

// Re-export types previously exported from this module
export type { CommentFormTarget } from "./diffStore";
export type { DiffOverflow } from "./displayStore";

// Expose a combined proxy for e2e tests in development mode.
// E2E helpers call __zustandStore.getState().someAction(...).
if (import.meta.env.DEV && typeof window !== "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).__zustandStore = {
    getState: () => ({
      ...useDisplayStore.getState(),
      ...useDiffStore.getState(),
      ...useReviewStore.getState(),
    }),
  };
}
