import { useCallback, useEffect } from "react";
import { useStore } from "../store";
import * as api from "../utils/tauri-api";
import type { DiffSource } from "../types";

/** Fetch diff data based on the current diff source */
export function useDiff() {
  const {
    diffSource,
    setDiffResult,
    setIsLoading,
    setError,
    setSelectedFile,
    diffResult,
  } = useStore();

  const fetchDiff = useCallback(
    async (source: DiffSource) => {
      setIsLoading(true);
      setError(null);
      try {
        let result;
        switch (source.type) {
          case "uncommitted":
            result = await api.getDiff();
            break;
          case "staged":
            result = await api.getStagedDiff();
            break;
          case "working":
            result = await api.getWorkingDiff();
            break;
          case "commit":
            result = await api.getCommitDiff(source.ref);
            break;
          case "range":
            result = await api.getRefDiff(source.from, source.to);
            break;
        }
        setDiffResult(result);
        // Auto-select first file
        if (result.files.length > 0) {
          setSelectedFile(result.files[0].file.path);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setDiffResult(null);
      } finally {
        setIsLoading(false);
      }
    },
    [setDiffResult, setIsLoading, setError, setSelectedFile],
  );

  // Fetch on source change
  useEffect(() => {
    fetchDiff(diffSource);
  }, [diffSource, fetchDiff]);

  return { refetch: () => fetchDiff(diffSource), diffResult };
}
