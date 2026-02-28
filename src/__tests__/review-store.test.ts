import { describe, it, expect, beforeEach } from "vitest";
import { useReviewStore } from "../store/reviewStore";
import type { ReviewComment, DocComment } from "../types";

function makeComment(overrides: Partial<ReviewComment> = {}): ReviewComment {
  return {
    id: "c1",
    file_path: "src/App.tsx",
    line_start: 10,
    line_end: 10,
    code_snippet: "const x = 1;",
    body: "Fix this.",
    type: "comment",
    created_at: 1700000000,
    author: "human",
    ...overrides,
  };
}

function makeDocComment(overrides: Partial<DocComment> = {}): DocComment {
  return {
    id: "d1",
    file_path: "docs/architecture.md",
    section: "Overview",
    body: "Needs more detail.",
    type: "comment",
    created_at: 1700000000,
    author: "human",
    resolved: false,
    resolved_at: null,
    ...overrides,
  };
}

beforeEach(() => {
  useReviewStore.setState({
    threads: new Map(),
    docComments: [],
    verdict: null,
    gateStatus: "none",
  });
});

describe("useReviewStore - threads", () => {
  it("addThread creates a thread for the file", () => {
    const root = makeComment();
    useReviewStore.getState().addThread("src/App.tsx", root);
    const threads = useReviewStore.getState().getFileThreads("src/App.tsx");
    expect(threads).toHaveLength(1);
    expect(threads[0].root.id).toBe("c1");
    expect(threads[0].replies).toHaveLength(0);
    expect(threads[0].resolved).toBe(false);
  });

  it("addThread groups threads by file path", () => {
    useReviewStore.getState().addThread("src/App.tsx", makeComment({ id: "c1" }));
    useReviewStore.getState().addThread("src/utils.ts", makeComment({ id: "c2", file_path: "src/utils.ts" }));
    useReviewStore.getState().addThread("src/App.tsx", makeComment({ id: "c3" }));

    expect(useReviewStore.getState().getFileThreads("src/App.tsx")).toHaveLength(2);
    expect(useReviewStore.getState().getFileThreads("src/utils.ts")).toHaveLength(1);
  });

  it("getFileThreads returns empty array for unknown file", () => {
    const threads = useReviewStore.getState().getFileThreads("nonexistent.ts");
    expect(threads).toHaveLength(0);
  });

  it("getAllThreads returns flat list of all threads", () => {
    useReviewStore.getState().addThread("src/App.tsx", makeComment({ id: "c1" }));
    useReviewStore.getState().addThread("src/utils.ts", makeComment({ id: "c2", file_path: "src/utils.ts" }));
    const all = useReviewStore.getState().getAllThreads();
    expect(all).toHaveLength(2);
  });

  it("removeThread removes a thread by root id", () => {
    useReviewStore.getState().addThread("src/App.tsx", makeComment({ id: "c1" }));
    useReviewStore.getState().addThread("src/App.tsx", makeComment({ id: "c2" }));
    useReviewStore.getState().removeThread("c1");
    expect(useReviewStore.getState().getFileThreads("src/App.tsx")).toHaveLength(1);
    expect(useReviewStore.getState().getFileThreads("src/App.tsx")[0].root.id).toBe("c2");
  });

  it("removeThread removes file key when last thread is removed", () => {
    useReviewStore.getState().addThread("src/App.tsx", makeComment({ id: "c1" }));
    useReviewStore.getState().removeThread("c1");
    expect(useReviewStore.getState().threads.has("src/App.tsx")).toBe(false);
  });

  it("removeThread with non-existent id is a no-op", () => {
    useReviewStore.getState().addThread("src/App.tsx", makeComment({ id: "c1" }));
    useReviewStore.getState().removeThread("nonexistent");
    expect(useReviewStore.getState().getFileThreads("src/App.tsx")).toHaveLength(1);
  });

  it("resolveThread sets resolved=true and resolved_at", () => {
    useReviewStore.getState().addThread("src/App.tsx", makeComment({ id: "c1" }));
    useReviewStore.getState().resolveThread("c1");

    const thread = useReviewStore.getState().getFileThreads("src/App.tsx")[0];
    expect(thread.resolved).toBe(true);
    expect(thread.resolved_at).toBeTypeOf("number");
  });

  it("unresolveThread resets resolved to false", () => {
    useReviewStore.getState().addThread("src/App.tsx", makeComment({ id: "c1" }));
    useReviewStore.getState().resolveThread("c1");
    useReviewStore.getState().unresolveThread("c1");

    const thread = useReviewStore.getState().getFileThreads("src/App.tsx")[0];
    expect(thread.resolved).toBe(false);
    expect(thread.resolved_at).toBeNull();
  });

  it("addReply appends a reply to the thread", () => {
    useReviewStore.getState().addThread("src/App.tsx", makeComment({ id: "c1" }));
    useReviewStore.getState().addReply("c1", "Fixed it.");

    const thread = useReviewStore.getState().getFileThreads("src/App.tsx")[0];
    expect(thread.replies).toHaveLength(1);
    expect(thread.replies[0].body).toBe("Fixed it.");
    expect(thread.replies[0].author).toBe("human");
  });

  it("addReply with author parameter", () => {
    useReviewStore.getState().addThread("src/App.tsx", makeComment({ id: "c1" }));
    useReviewStore.getState().addReply("c1", "Auto-fixed.", "claude");

    const reply = useReviewStore.getState().getFileThreads("src/App.tsx")[0].replies[0];
    expect(reply.author).toBe("claude");
  });

  it("addReply to non-existent thread is a no-op", () => {
    useReviewStore.getState().addThread("src/App.tsx", makeComment({ id: "c1" }));
    useReviewStore.getState().addReply("nonexistent", "Hello");
    const thread = useReviewStore.getState().getFileThreads("src/App.tsx")[0];
    expect(thread.replies).toHaveLength(0);
  });

  it("setThreads replaces all threads from a flat array", () => {
    const threads = [
      { root: makeComment({ id: "c1" }), replies: [], resolved: false, resolved_at: null },
      { root: makeComment({ id: "c2", file_path: "src/utils.ts" }), replies: [], resolved: true, resolved_at: 123 },
    ];
    useReviewStore.getState().setThreads(threads);

    expect(useReviewStore.getState().getFileThreads("src/App.tsx")).toHaveLength(1);
    expect(useReviewStore.getState().getFileThreads("src/utils.ts")).toHaveLength(1);
    expect(useReviewStore.getState().getFileThreads("src/utils.ts")[0].resolved).toBe(true);
  });
});

describe("useReviewStore - docComments", () => {
  it("addDocComment appends a doc comment", () => {
    useReviewStore.getState().addDocComment(makeDocComment());
    expect(useReviewStore.getState().docComments).toHaveLength(1);
    expect(useReviewStore.getState().docComments[0].id).toBe("d1");
  });

  it("removeDocComment removes a doc comment by id", () => {
    useReviewStore.getState().addDocComment(makeDocComment({ id: "d1" }));
    useReviewStore.getState().addDocComment(makeDocComment({ id: "d2" }));
    useReviewStore.getState().removeDocComment("d1");
    expect(useReviewStore.getState().docComments).toHaveLength(1);
    expect(useReviewStore.getState().docComments[0].id).toBe("d2");
  });

  it("resolveDocComment sets resolved=true and resolved_at", () => {
    useReviewStore.getState().addDocComment(makeDocComment({ id: "d1" }));
    useReviewStore.getState().resolveDocComment("d1");

    const resolved = useReviewStore.getState().docComments[0];
    expect(resolved.resolved).toBe(true);
    expect(resolved.resolved_at).toBeTypeOf("number");
  });

  it("unresolveDocComment resets resolved to false", () => {
    useReviewStore.getState().addDocComment(makeDocComment({ id: "d1" }));
    useReviewStore.getState().resolveDocComment("d1");
    useReviewStore.getState().unresolveDocComment("d1");

    const comment = useReviewStore.getState().docComments[0];
    expect(comment.resolved).toBe(false);
    expect(comment.resolved_at).toBeNull();
  });

  it("setDocComments replaces the entire doc comments array", () => {
    const docComments = [makeDocComment({ id: "d1" }), makeDocComment({ id: "d2" })];
    useReviewStore.getState().setDocComments(docComments);
    expect(useReviewStore.getState().docComments).toHaveLength(2);
  });
});

describe("useReviewStore - verdict & gate", () => {
  it("setVerdict sets the review verdict", () => {
    useReviewStore.getState().setVerdict("approve");
    expect(useReviewStore.getState().verdict).toBe("approve");

    useReviewStore.getState().setVerdict("request_changes");
    expect(useReviewStore.getState().verdict).toBe("request_changes");

    useReviewStore.getState().setVerdict(null);
    expect(useReviewStore.getState().verdict).toBeNull();
  });

  it("setGateStatus changes gate status", () => {
    useReviewStore.getState().setGateStatus("approved");
    expect(useReviewStore.getState().gateStatus).toBe("approved");
  });
});
