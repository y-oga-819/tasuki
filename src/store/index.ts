import { create } from "zustand";
import type { SelectedLineRange } from "@pierre/diffs";
import type {
  DiffResult,
  DiffSource,
  DisplayMode,
  DiffLayout,
  ReviewComment,
  DocComment,
  ReviewVerdict,
  ReviewRestoreMode,
  RepoInfo,
} from "../types";

/** Target line where the comment form is being shown */
export interface CommentFormTarget {
  filePath: string;
  lineNumber: number;
  side: "deletions" | "additions";
  selectionStart: number;
  selectionEnd: number;
}

/** Overflow mode for diff lines (Pierre-native) */
export type DiffOverflow = "scroll" | "wrap";

interface TasukiState {
  // Display
  displayMode: DisplayMode;
  setDisplayMode: (mode: DisplayMode) => void;
  diffLayout: DiffLayout;
  setDiffLayout: (layout: DiffLayout) => void;
  diffOverflow: DiffOverflow;
  setDiffOverflow: (overflow: DiffOverflow) => void;
  expandUnchanged: boolean;
  setExpandUnchanged: (expand: boolean) => void;

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

  // Pierre-native diff state
  selectedLineRange: SelectedLineRange | null;
  setSelectedLineRange: (range: SelectedLineRange | null) => void;
  commentFormTarget: CommentFormTarget | null;
  setCommentFormTarget: (target: CommentFormTarget | null) => void;

  // Review comments
  comments: ReviewComment[];
  addComment: (comment: ReviewComment) => void;
  removeComment: (id: string) => void;
  updateComment: (id: string, body: string) => void;
  setComments: (comments: ReviewComment[]) => void;

  // Doc comments
  docComments: DocComment[];
  addDocComment: (comment: DocComment) => void;
  removeDocComment: (id: string) => void;
  setDocComments: (comments: DocComment[]) => void;

  // Review
  verdict: ReviewVerdict;
  setVerdict: (verdict: ReviewVerdict) => void;

  // Review persistence
  reviewRestoreMode: ReviewRestoreMode;
  setReviewRestoreMode: (mode: ReviewRestoreMode) => void;

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

export const useStore = create<TasukiState>((set) => ({
  // Display
  displayMode: "diff",
  setDisplayMode: (mode) => set({ displayMode: mode }),
  diffLayout: "split",
  setDiffLayout: (layout) => set({ diffLayout: layout }),
  diffOverflow: "scroll",
  setDiffOverflow: (overflow) => set({ diffOverflow: overflow }),
  expandUnchanged: false,
  setExpandUnchanged: (expand) => set({ expandUnchanged: expand }),

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

  // Pierre-native diff state
  selectedLineRange: null,
  setSelectedLineRange: (range) => set({ selectedLineRange: range }),
  commentFormTarget: null,
  setCommentFormTarget: (target) => set({ commentFormTarget: target }),

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

  setComments: (comments) => set({ comments }),

  // Doc comments (cont.)
  setDocComments: (docComments) => set({ docComments }),

  // Review
  verdict: null,
  setVerdict: (verdict) => set({ verdict }),

  // Review persistence
  reviewRestoreMode: "none",
  setReviewRestoreMode: (mode) => set({ reviewRestoreMode: mode }),

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
