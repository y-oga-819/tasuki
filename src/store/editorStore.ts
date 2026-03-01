import { create } from "zustand";
import type { SelectedLineRange } from "@pierre/diffs";

/** Target line where the comment form is being shown */
export interface CommentFormTarget {
  filePath: string;
  lineNumber: number;
  side: "deletions" | "additions";
  selectionStart: number;
  selectionEnd: number;
}

/** Unified line selection (file + range as single object) */
export interface LineSelection {
  file: string;
  range: SelectedLineRange;
}

interface EditorState {
  // Line selection (unified)
  lineSelection: LineSelection | null;
  setLineSelection: (range: SelectedLineRange | null, filePath?: string | null) => void;

  // Comment form
  commentFormTarget: CommentFormTarget | null;
  setCommentFormTarget: (target: CommentFormTarget | null) => void;

  // Diff search state (persists across file switches) [M7]
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchMatches: number;
  setSearchMatches: (count: number) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  lineSelection: null,
  setLineSelection: (range, filePath) =>
    set({
      lineSelection:
        range && filePath ? { file: filePath, range } : null,
    }),
  commentFormTarget: null,
  setCommentFormTarget: (target) => set({ commentFormTarget: target }),
  searchQuery: "",
  setSearchQuery: (query) => set({ searchQuery: query }),
  searchMatches: 0,
  setSearchMatches: (count) => set({ searchMatches: count }),
}));
