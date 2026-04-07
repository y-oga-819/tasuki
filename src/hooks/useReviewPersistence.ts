import { useCallback, useEffect, useRef } from "react";
import { useReviewStore } from "../store/reviewStore";
import { gateToThreads, gateDocToDocComments, threadsToGate, docCommentsToGateDoc } from "../store/gate-convert";
import { eventBus } from "../utils/tauri-events";
import * as api from "../utils/tauri-api";
import { writeGateFile, getLastWrittenHash, clearLastWrittenHash } from "../utils/gate-writer";
import { appLogger } from "../utils/app-logger";

/**
 * Hook that persists review state to the gate file and restores on startup.
 *
 * - On mount: reads gate file → converts to store format → sets store state
 * - On state change: converts store → gate file format → writes gate file (debounced)
 * - On gate-file-changed event: re-reads gate file and updates store (unless self-write)
 */
export function useReviewPersistence() {
  const {
    threads,
    docComments,
    status,
    setThreads,
    setDocComments,
    setStatus,
    setGateStatus,
    getAllThreads,
  } = useReviewStore();

  const loadedRef = useRef(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Read gate file and update store */
  const loadGateFile = useCallback(async () => {
    try {
      const gateData = await api.readCommitGate();
      if (!gateData) return;

      // Ignore v2 or older gate files
      if (gateData.version < 3) {
        appLogger.warn("persistence", "Ignoring gate file with version < 3");
        return;
      }

      const reviewThreads = gateToThreads(gateData.threads);
      const loadedDocComments = gateDocToDocComments(gateData.doc_threads);

      setThreads(reviewThreads);
      setDocComments(loadedDocComments);
      setStatus(gateData.status);
      setGateStatus(gateData.status);
    } catch {
      // Failed to load (e.g. outside Tauri) — start fresh
    }
  }, [setThreads, setDocComments, setStatus, setGateStatus]);

  // Load from gate file on startup
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    loadGateFile();
  }, [loadGateFile]);

  // Save to gate file (debounced) whenever state changes
  const save = useCallback(async () => {
    const currentStatus = useReviewStore.getState().status;
    if (!currentStatus) return;

    const allThreads = getAllThreads();
    const currentDocComments = useReviewStore.getState().docComments;

    const gateThreads = threadsToGate(allThreads);
    const gateDocThreads = docCommentsToGateDoc(currentDocComments);

    try {
      await writeGateFile(currentStatus, gateThreads, gateDocThreads);
    } catch (err) {
      appLogger.warn("persistence", "Failed to save gate file", err);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- threads/docComments/status trigger recomputation
  }, [threads, docComments, status, getAllThreads]);

  // Debounced auto-save on state changes
  useEffect(() => {
    if (!loadedRef.current) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(save, 500);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [save]);

  // Listen for gate-file-changed events from Tauri watcher
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    (async () => {
      unlisten = await eventBus.listen("gate-file-changed", async () => {
        try {
          const gateData = await api.readCommitGate();

          // Gate file deleted — reset state
          if (!gateData) {
            setThreads([]);
            setDocComments([]);
            setStatus(null);
            setGateStatus("none");
            clearLastWrittenHash();
            return;
          }

          if (gateData.version < 3) return;

          const contentHash = JSON.stringify({
            gateThreads: gateData.threads,
            gateDocThreads: gateData.doc_threads,
            status: gateData.status,
          });

          // Skip if this is our own write
          if (contentHash === getLastWrittenHash()) return;

          appLogger.warn("persistence", "Gate file changed externally, reloading");
          const reviewThreads = gateToThreads(gateData.threads);
          const loadedDocComments = gateDocToDocComments(gateData.doc_threads);

          setThreads(reviewThreads);
          setDocComments(loadedDocComments);
          setStatus(gateData.status);
          setGateStatus(gateData.status);
        } catch (err) {
          appLogger.warn("persistence", "Failed to reload gate file", err);
        }
      });
    })();

    return () => unlisten?.();
  }, [setThreads, setDocComments, setStatus, setGateStatus]);
}
