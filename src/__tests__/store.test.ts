import { describe, it, expect, beforeEach } from "vitest";
import { useStore } from "../store";
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
  useStore.setState({
    comments: [],
    docComments: [],
    verdict: null,
  });
});

describe("comments", () => {
  it("addComment appends a comment", () => {
    const comment = makeComment();
    useStore.getState().addComment(comment);
    expect(useStore.getState().comments).toHaveLength(1);
    expect(useStore.getState().comments[0].id).toBe("c1");
  });

  it("removeComment removes a comment by id", () => {
    useStore.getState().addComment(makeComment({ id: "c1" }));
    useStore.getState().addComment(makeComment({ id: "c2" }));
    useStore.getState().removeComment("c1");
    expect(useStore.getState().comments).toHaveLength(1);
    expect(useStore.getState().comments[0].id).toBe("c2");
  });

  it("resolveComment sets resolved=true, resolved_at, and resolution_memo", () => {
    useStore.getState().addComment(makeComment({ id: "c1" }));
    useStore.getState().resolveComment("c1", "Fixed in latest commit");

    const resolved = useStore.getState().comments[0];
    expect(resolved.resolved).toBe(true);
    expect(resolved.resolved_at).toBeTypeOf("number");
    expect(resolved.resolution_memo).toBe("Fixed in latest commit");
  });

  it("unresolveComment resets resolved to false", () => {
    useStore.getState().addComment(makeComment({ id: "c1" }));
    useStore.getState().resolveComment("c1", "Done");
    useStore.getState().unresolveComment("c1");

    const comment = useStore.getState().comments[0];
    expect(comment.resolved).toBe(false);
    expect(comment.resolved_at).toBeNull();
    expect(comment.resolution_memo).toBeNull();
  });
});

describe("docComments", () => {
  it("addDocComment appends a doc comment", () => {
    useStore.getState().addDocComment(makeDocComment());
    expect(useStore.getState().docComments).toHaveLength(1);
    expect(useStore.getState().docComments[0].id).toBe("d1");
  });

  it("removeDocComment removes a doc comment by id", () => {
    useStore.getState().addDocComment(makeDocComment({ id: "d1" }));
    useStore.getState().addDocComment(makeDocComment({ id: "d2" }));
    useStore.getState().removeDocComment("d1");
    expect(useStore.getState().docComments).toHaveLength(1);
    expect(useStore.getState().docComments[0].id).toBe("d2");
  });

  it("resolveDocComment sets resolved=true, resolved_at, and resolution_memo", () => {
    useStore.getState().addDocComment(makeDocComment({ id: "d1" }));
    useStore.getState().resolveDocComment("d1", "Updated section");

    const resolved = useStore.getState().docComments[0];
    expect(resolved.resolved).toBe(true);
    expect(resolved.resolved_at).toBeTypeOf("number");
    expect(resolved.resolution_memo).toBe("Updated section");
  });

  it("unresolveDocComment resets resolved to false", () => {
    useStore.getState().addDocComment(makeDocComment({ id: "d1" }));
    useStore.getState().resolveDocComment("d1", "Done");
    useStore.getState().unresolveDocComment("d1");

    const comment = useStore.getState().docComments[0];
    expect(comment.resolved).toBe(false);
    expect(comment.resolved_at).toBeNull();
    expect(comment.resolution_memo).toBeNull();
  });
});
