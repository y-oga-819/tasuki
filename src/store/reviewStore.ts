import { create } from "zustand";
import type {
  ReviewComment,
  DocComment,
  ReviewVerdict,
  GateStatus,
} from "../types";

/** Shared helper: mark a comment as resolved */
function resolveById<T extends { id: string; resolved: boolean; resolved_at: number | null; resolution_memo: string | null }>(
  items: T[],
  id: string,
  memo: string | null,
): T[] {
  return items.map((c) =>
    c.id === id
      ? { ...c, resolved: true, resolved_at: Date.now(), resolution_memo: memo }
      : c,
  );
}

/** Shared helper: mark a comment as unresolved */
function unresolveById<T extends { id: string; resolved: boolean; resolved_at: number | null; resolution_memo: string | null }>(
  items: T[],
  id: string,
): T[] {
  return items.map((c) =>
    c.id === id
      ? { ...c, resolved: false, resolved_at: null, resolution_memo: null }
      : c,
  );
}

interface ReviewState {
  // Review comments
  comments: ReviewComment[];
  addComment: (comment: ReviewComment) => void;
  removeComment: (id: string) => void;
  updateComment: (id: string, body: string) => void;
  resolveComment: (id: string, memo: string | null) => void;
  unresolveComment: (id: string) => void;
  setComments: (comments: ReviewComment[]) => void;

  // Doc comments
  docComments: DocComment[];
  addDocComment: (comment: DocComment) => void;
  removeDocComment: (id: string) => void;
  resolveDocComment: (id: string, memo: string | null) => void;
  unresolveDocComment: (id: string) => void;
  setDocComments: (comments: DocComment[]) => void;

  // Review
  verdict: ReviewVerdict;
  setVerdict: (verdict: ReviewVerdict) => void;

  // Commit gate
  gateStatus: GateStatus;
  setGateStatus: (status: GateStatus) => void;
}

export const useReviewStore = create<ReviewState>((set) => ({
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
  resolveComment: (id, memo) =>
    set((state) => ({ comments: resolveById(state.comments, id, memo) })),
  unresolveComment: (id) =>
    set((state) => ({ comments: unresolveById(state.comments, id) })),
  setComments: (comments) => set({ comments }),

  // Doc comments
  docComments: [],
  addDocComment: (comment) =>
    set((state) => ({ docComments: [...state.docComments, comment] })),
  removeDocComment: (id) =>
    set((state) => ({
      docComments: state.docComments.filter((c) => c.id !== id),
    })),
  resolveDocComment: (id, memo) =>
    set((state) => ({ docComments: resolveById(state.docComments, id, memo) })),
  unresolveDocComment: (id) =>
    set((state) => ({ docComments: unresolveById(state.docComments, id) })),
  setDocComments: (docComments) => set({ docComments }),

  // Review
  verdict: null,
  setVerdict: (verdict) => set({ verdict }),

  // Commit gate
  gateStatus: "none",
  setGateStatus: (status) => set({ gateStatus: status }),
}));
