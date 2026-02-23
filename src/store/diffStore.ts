import { create } from "zustand";
import type { SelectedLineRange } from "@pierre/diffs";
import type { DiffResult, DiffSource, RepoInfo } from "../types";

/** Target line where the comment form is being shown */
export interface CommentFormTarget {
  filePath: string;
  lineNumber: number;
  side: "deletions" | "additions";
  selectionStart: number;
  selectionEnd: number;
}

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
  docFiles: string[];
  setDocFiles: (files: string[]) => void;
  selectedDoc: string | null;
  setSelectedDoc: (path: string | null) => void;
  docContent: string | null;
  setDocContent: (content: string | null) => void;
  collapsedFiles: Set<string>;
  toggleFileCollapse: (path: string) => void;
  designDocs: string[];
  setDesignDocs: (docs: string[]) => void;
  docSource: "repo" | "design";
  setDocSource: (source: "repo" | "design") => void;

  // Pierre-native diff state
  selectedLineRange: SelectedLineRange | null;
  selectedLineFile: string | null;
  setSelectedLineRange: (range: SelectedLineRange | null, filePath?: string | null) => void;
  commentFormTarget: CommentFormTarget | null;
  setCommentFormTarget: (target: CommentFormTarget | null) => void;

  // Loading
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;

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
  docFiles: [],
  setDocFiles: (files) => set({ docFiles: files }),
  selectedDoc: null,
  setSelectedDoc: (path) => set({ selectedDoc: path }),
  docContent: null,
  setDocContent: (content) => set({ docContent: content }),
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
  designDocs: [],
  setDesignDocs: (docs) => set({ designDocs: docs }),
  docSource: "repo",
  setDocSource: (source) => set({ docSource: source }),

  // Pierre-native diff state
  selectedLineRange: null,
  selectedLineFile: null,
  setSelectedLineRange: (range, filePath) =>
    set({ selectedLineRange: range, selectedLineFile: filePath ?? null }),
  commentFormTarget: null,
  setCommentFormTarget: (target) => set({ commentFormTarget: target }),

  // Loading
  isLoading: false,
  setIsLoading: (loading) => set({ isLoading: loading }),
  error: null,
  setError: (error) => set({ error }),

  // Repo info
  repoPath: "",
  setRepoPath: (path) => set({ repoPath: path }),
  repoInfo: null,
  setRepoInfo: (info) => set({ repoInfo: info }),
}));
