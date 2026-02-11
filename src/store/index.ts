import { create } from "zustand";
import type {
  DiffResult,
  DiffSource,
  DisplayMode,
  DiffLayout,
  ReviewComment,
  DocComment,
  ReviewVerdict,
} from "../types";

interface TasukiState {
  // Display
  displayMode: DisplayMode;
  setDisplayMode: (mode: DisplayMode) => void;
  diffLayout: DiffLayout;
  setDiffLayout: (layout: DiffLayout) => void;

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

  // Review comments
  comments: ReviewComment[];
  addComment: (comment: ReviewComment) => void;
  removeComment: (id: string) => void;
  updateComment: (id: string, body: string) => void;

  // Doc comments
  docComments: DocComment[];
  addDocComment: (comment: DocComment) => void;
  removeDocComment: (id: string) => void;

  // Review
  verdict: ReviewVerdict;
  setVerdict: (verdict: ReviewVerdict) => void;

  // Loading
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;

  // Repo info
  repoPath: string;
  setRepoPath: (path: string) => void;
}

export const useStore = create<TasukiState>((set) => ({
  // Display
  displayMode: "diff",
  setDisplayMode: (mode) => set({ displayMode: mode }),
  diffLayout: "split",
  setDiffLayout: (layout) => set({ diffLayout: layout }),

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

  // Review comments
  comments: [],
  addComment: (comment) =>
    set((state) => ({ comments: [...state.comments, comment] })),
  removeComment: (id) =>
    set((state) => ({
      comments: state.comments.filter((c) => c.id !== id),
    })),
  updateComment: (id, body) =>
    set((state) => ({
      comments: state.comments.map((c) => (c.id === id ? { ...c, body } : c)),
    })),

  // Doc comments
  docComments: [],
  addDocComment: (comment) =>
    set((state) => ({ docComments: [...state.docComments, comment] })),
  removeDocComment: (id) =>
    set((state) => ({
      docComments: state.docComments.filter((c) => c.id !== id),
    })),

  // Review
  verdict: null,
  setVerdict: (verdict) => set({ verdict }),

  // Loading
  isLoading: false,
  setIsLoading: (loading) => set({ isLoading: loading }),
  error: null,
  setError: (error) => set({ error }),

  // Repo info
  repoPath: "",
  setRepoPath: (path) => set({ repoPath: path }),
}));
