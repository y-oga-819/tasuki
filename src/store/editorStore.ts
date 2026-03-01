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

interface EditorState {
  // Line selection
  selectedLineRange: SelectedLineRange | null;
  selectedLineFile: string | null;
  setSelectedLineRange: (range: SelectedLineRange | null, filePath?: string | null) => void;

  // Comment form
  commentFormTarget: CommentFormTarget | null;
  setCommentFormTarget: (target: CommentFormTarget | null) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  selectedLineRange: null,
  selectedLineFile: null,
  setSelectedLineRange: (range, filePath) =>
    set({ selectedLineRange: range, selectedLineFile: filePath ?? null }),
  commentFormTarget: null,
  setCommentFormTarget: (target) => set({ commentFormTarget: target }),
}));
