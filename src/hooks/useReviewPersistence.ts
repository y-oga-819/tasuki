import { useCallback, useEffect, useRef } from "react";
import { useDiffStore } from "../store/diffStore";
import { useReviewStore } from "../store/reviewStore";
import * as api from "../utils/tauri-api";
import { appLogger } from "../utils/app-logger";
import type { DiffSource, ReviewSession } from "../types";

/** Derive a stable key string from a DiffSource for file naming */
function sourceTypeKey(source: DiffSource): string {
  switch (source.type) {
    case "uncommitted":
      return "uncommitted";
    case "staged":
      return "staged";
    case "working":
      return "working";
    case "commit":
      return "commit";
    case "range":
      return "range";
  }
}

/**
 * Hook that persists review threads to .tasuki/reviews/ and
 * restores them on app startup based on HEAD SHA + diff hash.
 */
export function useReviewPersistence() {
  const { diffSource, diffResult } = useDiffStore();
  const {
    threads,
    docComments,
    verdict,
    setThreads,
    setDocComments,
    setVerdict,
    getAllThreads,
  } = useReviewStore();

  const headShaRef = useRef<string | null>(null);
  const diffHashRef = useRef<string | null>(null);
  const loadedRef = useRef(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load saved review on startup (once diffResult is available)
  useEffect(() => {
    if (!diffResult || loadedRef.current) return;
    loadedRef.current = true;

    (async () => {
      try {
        const headSha = await api.getHeadSha();
        headShaRef.current = headSha;

        const currentHash = await api.getDiffHash(diffResult);
        diffHashRef.current = currentHash;

        const sourceKey = sourceTypeKey(diffSource);
        const saved = await api.loadReview(headSha, sourceKey);

        if (!saved) {
          return;
        }

        setThreads(saved.threads);
        setDocComments(saved.doc_comments);
        setVerdict(saved.verdict);
      } catch {
        // Failed to load (e.g. outside Tauri) — start fresh
      }
    })();
  }, [diffResult, diffSource, setThreads, setDocComments, setVerdict]);

  // Save review (debounced) whenever threads/verdict change
  const save = useCallback(async () => {
    const headSha = headShaRef.current;
    const diffHash = diffHashRef.current;
    if (!headSha || !diffHash) return;

    const session: ReviewSession = {
      head_commit: headSha,
      diff_hash: diffHash,
      diff_source: diffSource,
      created_at: Date.now(),
      updated_at: Date.now(),
      verdict,
      threads: getAllThreads(),
      doc_comments: docComments,
    };

    const sourceKey = sourceTypeKey(diffSource);

    try {
      await api.saveReview(headSha, sourceKey, session);
    } catch (err) {
      appLogger.warn("persistence", "Failed to save review session", err);
    }
  }, [threads, docComments, verdict, diffSource, getAllThreads]);

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
}
