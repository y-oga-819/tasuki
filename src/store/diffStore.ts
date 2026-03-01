import { create } from "zustand";
import type { DiffResult, DiffSource, RepoInfo } from "../types";

// Re-export types that consumers may need
export type { DiffResult };

interface DiffState {
  // Data
  diffResult: DiffResult | null;
  setDiffResult: (result: DiffResult | null) => void;
  diffSource: DiffSource;
  setDiffSource: (source: DiffSource) => void;

  // Files
  selectedFile: string | null;
  setSelectedFile: (path: string | null) => void;
  collapsedFiles: Set<string>;
  toggleFileCollapse: (path: string) => void;

  // Loading
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;

  // Staleness (file watcher detected changes but diff not yet refreshed)
  isStale: boolean;
  setIsStale: (stale: boolean) => void;

  // Repo info
  repoPath: string;
  setRepoPath: (path: string) => void;
  repoInfo: RepoInfo | null;
  setRepoInfo: (info: RepoInfo | null) => void;
}

export const useDiffStore = create<DiffState>((set) => ({
  // Data
  diffResult: null,
  setDiffResult: (result) => set({ diffResult: result }),
  diffSource: { type: "uncommitted" },
  setDiffSource: (source) => set({ diffSource: source }),

  // Files
  selectedFile: null,
  setSelectedFile: (path) => set({ selectedFile: path }),
  collapsedFiles: new Set<string>(),
  toggleFileCollapse: (path) =>
    set((state) => {
      const next = new Set(state.collapsedFiles);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return { collapsedFiles: next };
    }),

  // Loading
  isLoading: false,
  setIsLoading: (loading) => set({ isLoading: loading }),
  error: null,
  setError: (error) => set({ error }),

  // Staleness
  isStale: false,
  setIsStale: (stale) => set({ isStale: stale }),

  // Repo info
  repoPath: "",
  setRepoPath: (path) => set({ repoPath: path }),
  repoInfo: null,
  setRepoInfo: (info) => set({ repoInfo: info }),
}));
