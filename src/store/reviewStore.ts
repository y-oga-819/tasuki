import { create } from "zustand";
import type {
  ReviewComment,
  ReviewThread,
  DocComment,
  ReviewVerdict,
  GateStatus,
} from "../types";

/** Empty array singleton to avoid unnecessary re-renders */
const EMPTY_THREADS: ReviewThread[] = [];

interface ReviewState {
  // Thread-based review comments (keyed by file path)
  threads: Map<string, ReviewThread[]>;
  addThread: (filePath: string, root: ReviewComment) => void;
  addReply: (threadId: string, body: string, author?: "human" | "claude") => void;
  resolveThread: (threadId: string) => void;
  unresolveThread: (threadId: string) => void;
  removeThread: (threadId: string) => void;
  getFileThreads: (filePath: string) => ReviewThread[];
  /** Flat list of all threads for iteration */
  getAllThreads: () => ReviewThread[];
  /** Replace all threads (for persistence restore) */
  setThreads: (threads: ReviewThread[]) => void;

  // Doc comments (kept as flat array — simpler model)
  docComments: DocComment[];
  addDocComment: (comment: DocComment) => void;
  removeDocComment: (id: string) => void;
  resolveDocComment: (id: string) => void;
  unresolveDocComment: (id: string) => void;
  setDocComments: (comments: DocComment[]) => void;

  // Review verdict
  verdict: ReviewVerdict;
  setVerdict: (verdict: ReviewVerdict) => void;

  // Commit gate
  gateStatus: GateStatus;
  setGateStatus: (status: GateStatus) => void;
}

/** Build a new Map with an updated thread list for a given file */
function updateThreadInMap(
  threads: Map<string, ReviewThread[]>,
  threadId: string,
  updater: (thread: ReviewThread) => ReviewThread | null,
): Map<string, ReviewThread[]> {
  const next = new Map(threads);
  for (const [filePath, fileThreads] of next) {
    const idx = fileThreads.findIndex((t) => t.root.id === threadId);
    if (idx === -1) continue;

    const updated = updater(fileThreads[idx]);
    if (updated === null) {
      // Remove thread
      const filtered = fileThreads.filter((_, i) => i !== idx);
      if (filtered.length === 0) {
        next.delete(filePath);
      } else {
        next.set(filePath, filtered);
      }
    } else {
      const copy = [...fileThreads];
      copy[idx] = updated;
      next.set(filePath, copy);
    }
    return next;
  }
  return threads; // not found, no change
}

/** Convert flat thread array to Map<filePath, threads[]> */
function threadsToMap(threads: ReviewThread[]): Map<string, ReviewThread[]> {
  const map = new Map<string, ReviewThread[]>();
  for (const thread of threads) {
    const filePath = thread.root.file_path;
    const existing = map.get(filePath) ?? [];
    existing.push(thread);
    map.set(filePath, existing);
  }
  return map;
}

export const useReviewStore = create<ReviewState>((set, get) => ({
  // Thread-based review comments
  threads: new Map(),

  addThread: (filePath, root) =>
    set((state) => {
      const next = new Map(state.threads);
      const existing = next.get(filePath) ?? [];
      const thread: ReviewThread = {
        root,
        replies: [],
        resolved: false,
        resolved_at: null,
      };
      next.set(filePath, [...existing, thread]);
      return { threads: next };
    }),

  addReply: (threadId, body, author = "human") =>
    set((state) => ({
      threads: updateThreadInMap(state.threads, threadId, (thread) => ({
        ...thread,
        replies: [
          ...thread.replies,
          {
            id: crypto.randomUUID(),
            file_path: thread.root.file_path,
            line_start: thread.root.line_start,
            line_end: thread.root.line_end,
            code_snippet: "",
            body,
            type: "comment" as const,
            created_at: Date.now(),
            author,
          },
        ],
      })),
    })),

  resolveThread: (threadId) =>
    set((state) => ({
      threads: updateThreadInMap(state.threads, threadId, (thread) => ({
        ...thread,
        resolved: true,
        resolved_at: Date.now(),
      })),
    })),

  unresolveThread: (threadId) =>
    set((state) => ({
      threads: updateThreadInMap(state.threads, threadId, (thread) => ({
        ...thread,
        resolved: false,
        resolved_at: null,
      })),
    })),

  removeThread: (threadId) =>
    set((state) => ({
      threads: updateThreadInMap(state.threads, threadId, () => null),
    })),

  getFileThreads: (filePath) => {
    return get().threads.get(filePath) ?? EMPTY_THREADS;
  },

  getAllThreads: () => {
    const all: ReviewThread[] = [];
    for (const fileThreads of get().threads.values()) {
      all.push(...fileThreads);
    }
    return all;
  },

  setThreads: (threads) =>
    set({ threads: threadsToMap(threads) }),

  // Doc comments
  docComments: [],
  addDocComment: (comment) =>
    set((state) => ({ docComments: [...state.docComments, comment] })),
  removeDocComment: (id) =>
    set((state) => ({
      docComments: state.docComments.filter((c) => c.id !== id),
    })),
  resolveDocComment: (id) =>
    set((state) => ({
      docComments: state.docComments.map((c) =>
        c.id === id ? { ...c, resolved: true, resolved_at: Date.now() } : c,
      ),
    })),
  unresolveDocComment: (id) =>
    set((state) => ({
      docComments: state.docComments.map((c) =>
        c.id === id ? { ...c, resolved: false, resolved_at: null } : c,
      ),
    })),
  setDocComments: (docComments) => set({ docComments }),

  // Review verdict
  verdict: null,
  setVerdict: (verdict) => set({ verdict }),

  // Commit gate
  gateStatus: "none",
  setGateStatus: (status) => set({ gateStatus: status }),
}));
