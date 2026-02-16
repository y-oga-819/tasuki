import { useCallback, useEffect, useRef } from "react";
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
    selectedFile,
    diffResult,
  } = useStore();
  const sourceRef = useRef<DiffSource>(diffSource);
  const selectedFileRef = useRef<string | null>(selectedFile);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const pendingRef = useRef(false);

  useEffect(() => {
    selectedFileRef.current = selectedFile;
  }, [selectedFile]);

  const fetchDiffInner = useCallback(
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
        // Keep the current selection if it still exists.
        const currentSelected = selectedFileRef.current;
        const hasSelectedFile =
          currentSelected != null &&
          result.files.some((f) => f.file.path === currentSelected);
        if (result.files.length === 0) {
          setSelectedFile(null);
        } else if (!hasSelectedFile) {
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

  const fetchDiff = useCallback(() => {
    if (inFlightRef.current) {
      pendingRef.current = true;
      return inFlightRef.current;
    }

    const run = async () => {
      do {
        pendingRef.current = false;
        await fetchDiffInner(sourceRef.current);
      } while (pendingRef.current);
    };

    const promise = run().finally(() => {
      inFlightRef.current = null;
    });
    inFlightRef.current = promise;
    return promise;
  }, [fetchDiffInner]);

  useEffect(() => {
    sourceRef.current = diffSource;
  }, [diffSource]);

  // Fetch on source change
  useEffect(() => {
    fetchDiff();
  }, [diffSource, fetchDiff]);

  return { refetch: fetchDiff, diffResult };
}
