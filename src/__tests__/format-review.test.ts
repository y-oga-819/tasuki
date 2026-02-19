import { describe, it, expect } from "vitest";
import { formatSingleComment, formatReviewPrompt } from "../utils/format-review";
import type { ReviewComment, DocComment, ReviewVerdict } from "../types";

function makeComment(overrides: Partial<ReviewComment> = {}): ReviewComment {
  return {
    id: "c1",
    file_path: "src/App.tsx",
    line_start: 10,
    line_end: 10,
    code_snippet: "const x = 1;",
    body: "This should be a constant.",
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
    body: "This section needs more detail.",
    type: "comment",
    created_at: 1700000000,
    author: "human",
    resolved: false,
    resolved_at: null,
    resolution_memo: null,
    ...overrides,
  };
}

describe("formatSingleComment", () => {
  it("formats a comment with line number, snippet, and body", () => {
    const result = formatSingleComment(makeComment());
    expect(result).toBe(
      "src/App.tsx:L10\n> const x = 1;\n\nThis should be a constant.",
    );
  });

  it("formats a multi-line range as L10-15", () => {
    const result = formatSingleComment(makeComment({ line_start: 10, line_end: 15 }));
    expect(result).toContain("src/App.tsx:L10-15");
  });

  it("omits snippet block when code_snippet is empty", () => {
    const result = formatSingleComment(makeComment({ code_snippet: "" }));
    expect(result).toBe("src/App.tsx:L10\n\nThis should be a constant.");
  });
});

describe("formatReviewPrompt", () => {
  it("formats a single comment", () => {
    const result = formatReviewPrompt([makeComment()], [], null);
    expect(result).toContain("## Review Result: Comments");
    expect(result).toContain("### src/App.tsx");
    expect(result).toContain("- L10");
    expect(result).toContain("  > const x = 1;");
    expect(result).toContain("  This should be a constant.");
  });

  it("groups multiple comments by file", () => {
    const comments = [
      makeComment({ id: "c1", file_path: "src/App.tsx", body: "Comment 1" }),
      makeComment({ id: "c2", file_path: "src/utils.ts", body: "Comment 2" }),
      makeComment({ id: "c3", file_path: "src/App.tsx", body: "Comment 3" }),
    ];
    const result = formatReviewPrompt(comments, [], null);

    const appIdx = result.indexOf("### src/App.tsx");
    const utilsIdx = result.indexOf("### src/utils.ts");
    expect(appIdx).toBeGreaterThan(-1);
    expect(utilsIdx).toBeGreaterThan(-1);
    expect(result).toContain("Comment 1");
    expect(result).toContain("Comment 2");
    expect(result).toContain("Comment 3");
  });

  it("includes docComments", () => {
    const docComment = makeDocComment();
    const result = formatReviewPrompt([], [docComment], null);
    expect(result).toContain("### docs/architecture.md");
    expect(result).toContain("Overview: This section needs more detail.");
  });

  it("formats verdict=approve with Approve header and LGTM summary", () => {
    const result = formatReviewPrompt([makeComment()], [], "approve");
    expect(result).toContain("## Review Result: Approve");
    expect(result).toContain("### Summary");
    expect(result).toContain("LGTM");
  });

  it("formats verdict=request_changes with Request Changes header", () => {
    const result = formatReviewPrompt([makeComment()], [], "request_changes");
    expect(result).toContain("## Review Result: Request Changes");
    expect(result).toContain("### Summary");
    expect(result).toContain("Please address the above comments");
  });

  it("formats verdict=null with Comments header and no summary", () => {
    const result = formatReviewPrompt([makeComment()], [], null);
    expect(result).toContain("## Review Result: Comments");
    expect(result).not.toContain("### Summary");
  });
});
