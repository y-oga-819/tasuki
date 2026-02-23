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
    parent_id: null,
    author: "human",
    resolved: false,
    resolved_at: null,
    resolution_memo: null,
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
    resolution_memo: null,
    ...overrides,
  };
}

beforeEach(() => {
  useReviewStore.setState({
    comments: [],
    docComments: [],
    verdict: null,
    gateStatus: "none",
    reviewRestoreMode: "none",
  });
});

describe("useReviewStore - comments", () => {
  it("addComment appends a comment", () => {
    const comment = makeComment();
    useReviewStore.getState().addComment(comment);
    expect(useReviewStore.getState().comments).toHaveLength(1);
    expect(useReviewStore.getState().comments[0].id).toBe("c1");
  });

  it("removeComment removes a comment by id", () => {
    useReviewStore.getState().addComment(makeComment({ id: "c1" }));
    useReviewStore.getState().addComment(makeComment({ id: "c2" }));
    useReviewStore.getState().removeComment("c1");
    expect(useReviewStore.getState().comments).toHaveLength(1);
    expect(useReviewStore.getState().comments[0].id).toBe("c2");
  });

  it("updateComment updates the body", () => {
    useReviewStore.getState().addComment(makeComment({ id: "c1" }));
    useReviewStore.getState().updateComment("c1", "Updated body");
    expect(useReviewStore.getState().comments[0].body).toBe("Updated body");
  });

  it("resolveComment sets resolved=true, resolved_at, and resolution_memo", () => {
    useReviewStore.getState().addComment(makeComment({ id: "c1" }));
    useReviewStore.getState().resolveComment("c1", "Fixed in latest commit");

    const resolved = useReviewStore.getState().comments[0];
    expect(resolved.resolved).toBe(true);
    expect(resolved.resolved_at).toBeTypeOf("number");
    expect(resolved.resolution_memo).toBe("Fixed in latest commit");
  });

  it("unresolveComment resets resolved to false", () => {
    useReviewStore.getState().addComment(makeComment({ id: "c1" }));
    useReviewStore.getState().resolveComment("c1", "Done");
    useReviewStore.getState().unresolveComment("c1");

    const comment = useReviewStore.getState().comments[0];
    expect(comment.resolved).toBe(false);
    expect(comment.resolved_at).toBeNull();
    expect(comment.resolution_memo).toBeNull();
  });

  it("setComments replaces the entire comments array", () => {
    const comments = [makeComment({ id: "c1" }), makeComment({ id: "c2" })];
    useReviewStore.getState().setComments(comments);
    expect(useReviewStore.getState().comments).toHaveLength(2);
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

  it("resolveDocComment sets resolved=true, resolved_at, and resolution_memo", () => {
    useReviewStore.getState().addDocComment(makeDocComment({ id: "d1" }));
    useReviewStore.getState().resolveDocComment("d1", "Updated section");

    const resolved = useReviewStore.getState().docComments[0];
    expect(resolved.resolved).toBe(true);
    expect(resolved.resolved_at).toBeTypeOf("number");
    expect(resolved.resolution_memo).toBe("Updated section");
  });

  it("unresolveDocComment resets resolved to false", () => {
    useReviewStore.getState().addDocComment(makeDocComment({ id: "d1" }));
    useReviewStore.getState().resolveDocComment("d1", "Done");
    useReviewStore.getState().unresolveDocComment("d1");

    const comment = useReviewStore.getState().docComments[0];
    expect(comment.resolved).toBe(false);
    expect(comment.resolved_at).toBeNull();
    expect(comment.resolution_memo).toBeNull();
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

  it("setReviewRestoreMode changes restore mode", () => {
    useReviewStore.getState().setReviewRestoreMode("full");
    expect(useReviewStore.getState().reviewRestoreMode).toBe("full");

    useReviewStore.getState().setReviewRestoreMode("checklist");
    expect(useReviewStore.getState().reviewRestoreMode).toBe("checklist");
  });
});
