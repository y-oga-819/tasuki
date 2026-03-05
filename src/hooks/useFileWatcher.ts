import { useEffect, useRef, useCallback } from "react";

import * as api from "../utils/tauri-api";
import { eventBus } from "../utils/tauri-events";
import { useDiffStore } from "../store/diffStore";
import { useReviewStore } from "../store/reviewStore";
import { appLogger } from "../utils/app-logger";

const isTauri = typeof window !== "undefined" && "__TAURI__" in window;

/**
 * Watch for file changes and manage the "stale diff" UX.
 *
 * Strategy:
 * - HEAD SHA changes → immediate refresh + clear all review comments
 *   (the diff code being commented on has been committed)
 * - Working tree changes → show stale banner (user manually refreshes)
 * - Window focus regain → auto-refresh if stale
 */
export function useFileWatcher(refetch: () => void, debounceMs = 400) {
  const lastHeadShaRef = useRef<string | null>(null);
  const { setIsStale } = useDiffStore();
  const {
    setThreads,
    setDocComments,
    setVerdict,
    setGateStatus,
  } = useReviewStore();

  // Wrapped refetch that clears stale state
  const refreshAndClearStale = useCallback(() => {
    setIsStale(false);
    refetch();
  }, [refetch, setIsStale]);

  // Invalidate commit gate when files change
  const invalidateGate = useCallback(async () => {
    const currentGateStatus = useReviewStore.getState().gateStatus;
    if (currentGateStatus === "approved" || currentGateStatus === "rejected") {
      try {
        await api.clearCommitGate();
      } catch {
        /* ignore */
      }
      setGateStatus("invalidated");
      setVerdict(null);
    }
  }, [setGateStatus, setVerdict]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let timerId: number | undefined;

    const handleFilesChanged = async () => {
      try {
        const status = await api.checkChanges();

        // First run: just record the HEAD SHA
        if (lastHeadShaRef.current === null) {
          lastHeadShaRef.current = status.head_sha;
        }

        const headChanged = status.head_sha !== lastHeadShaRef.current;
        lastHeadShaRef.current = status.head_sha;

        if (headChanged) {
          // HEAD changed → immediate refresh + clear all comments
          appLogger.warn("file-watcher", "HEAD SHA changed, refreshing and clearing comments");
          setThreads([]);
          setDocComments([]);
          setVerdict(null);
          refreshAndClearStale();
          await invalidateGate();
        } else if (status.has_changes) {
          // Working tree changes → mark as stale (banner will appear)
          setIsStale(true);
          await invalidateGate();
        }
      } catch (err) {
        appLogger.warn("file-watcher", "check_changes failed, falling back to direct refresh", err);
        // Fallback: just refresh directly
        refreshAndClearStale();
      }
    };

    (async () => {
      // Initialize HEAD SHA
      try {
        const status = await api.checkChanges();
        lastHeadShaRef.current = status.head_sha;
      } catch {
        // Ignore — will get set on first change event
      }

      try {
        await api.startWatching();
        unlisten = await eventBus.listen<string[]>("files-changed", () => {
          if (timerId !== undefined) {
            window.clearTimeout(timerId);
          }
          timerId = window.setTimeout(() => {
            timerId = undefined;
            handleFilesChanged();
          }, debounceMs);
        });
      } catch (err) {
        appLogger.warn("file-watcher", "Failed to start file watcher", err);
      }
    })();

    return () => {
      if (timerId !== undefined) {
        window.clearTimeout(timerId);
      }
      unlisten?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounceMs]);

  // Auto-refresh on window focus regain when stale
  useEffect(() => {
    let unlistenFocus: (() => void) | undefined;

    if (isTauri) {
      // Tauri: listen to the window-focus-changed event emitted from Rust
      (async () => {
        unlistenFocus = await eventBus.listen<boolean>("window-focus-changed", (focused) => {
          if (focused && useDiffStore.getState().isStale) {
            appLogger.warn("file-watcher", "Window focused while stale, auto-refreshing");
            refreshAndClearStale();
          }
        });
      })();
    } else {
      // Browser: use visibilitychange
      const onVisibilityChange = () => {
        if (document.visibilityState === "visible" && useDiffStore.getState().isStale) {
          appLogger.warn("file-watcher", "Tab visible while stale, auto-refreshing");
          refreshAndClearStale();
        }
      };
      document.addEventListener("visibilitychange", onVisibilityChange);
      unlistenFocus = () => document.removeEventListener("visibilitychange", onVisibilityChange);
    }

    return () => unlistenFocus?.();
  }, [refreshAndClearStale]);
}
