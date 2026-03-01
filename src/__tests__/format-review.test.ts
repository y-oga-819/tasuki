import { describe, it, expect } from "vitest";
import { formatSingleComment, formatReviewPrompt } from "../utils/format-review";
import { formatLineRef, getStatusColor, getStatusLabel } from "../utils/diff-utils";
import type { ReviewComment, ReviewThread, DocComment } from "../types";

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
    author: "human",
    ...overrides,
  };
}

function makeThread(overrides: Partial<ReviewThread> = {}, rootOverrides: Partial<ReviewComment> = {}): ReviewThread {
  return {
    root: makeComment(rootOverrides),
    replies: [],
    resolved: false,
    resolved_at: null,
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
    ...overrides,
  };
}

describe("formatLineRef", () => {
  it("returns single line ref for same start/end", () => {
    expect(formatLineRef(10, 10)).toBe("L10");
  });

  it("returns range ref for different start/end", () => {
    expect(formatLineRef(10, 15)).toBe("L10-15");
  });

  it("returns L1 for line 1", () => {
    expect(formatLineRef(1, 1)).toBe("L1");
  });
});

describe("getStatusColor and getStatusLabel", () => {
  it("maps all known statuses consistently", () => {
    // Ensure color and label exist for same statuses
    for (const status of ["added", "deleted", "modified", "renamed"]) {
      expect(getStatusColor(status)).toMatch(/^var\(--color-/);
      expect(getStatusLabel(status)).toMatch(/^[A-Z]$/);
    }
  });

  it("returns fallback for unknown status", () => {
    expect(getStatusColor("unknown")).toBe("var(--color-text-secondary)");
    expect(getStatusLabel("unknown")).toBe("?");
  });
});

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
  it("formats a single thread", () => {
    const result = formatReviewPrompt([makeThread()], [], null);
    expect(result).toContain("## Review Result: Comments");
    expect(result).toContain("### src/App.tsx");
    expect(result).toContain("- L10");
    expect(result).toContain("  > const x = 1;");
    expect(result).toContain("  This should be a constant.");
  });

  it("groups multiple threads by file", () => {
    const threads = [
      makeThread({}, { id: "c1", file_path: "src/App.tsx", body: "Comment 1" }),
      makeThread({}, { id: "c2", file_path: "src/utils.ts", body: "Comment 2" }),
      makeThread({}, { id: "c3", file_path: "src/App.tsx", body: "Comment 3" }),
    ];
    const result = formatReviewPrompt(threads, [], null);

    const appIdx = result.indexOf("### src/App.tsx");
    const utilsIdx = result.indexOf("### src/utils.ts");
    expect(appIdx).toBeGreaterThan(-1);
    expect(utilsIdx).toBeGreaterThan(-1);
    expect(result).toContain("Comment 1");
    expect(result).toContain("Comment 2");
    expect(result).toContain("Comment 3");
  });

  it("includes thread replies", () => {
    const thread = makeThread({
      replies: [
        makeComment({ id: "r1", body: "Fixed it.", author: "claude" }),
      ],
    });
    const result = formatReviewPrompt([thread], [], null);
    expect(result).toContain("↳ Fixed it. — claude");
  });

  it("marks resolved threads", () => {
    const thread = makeThread({ resolved: true, resolved_at: 123 });
    const result = formatReviewPrompt([thread], [], null);
    expect(result).toContain("✓ Resolved");
  });

  it("includes docComments", () => {
    const docComment = makeDocComment();
    const result = formatReviewPrompt([], [docComment], null);
    expect(result).toContain("### docs/architecture.md");
    expect(result).toContain("Overview: This section needs more detail.");
  });

  it("formats verdict=approve with Approve header and LGTM summary", () => {
    const result = formatReviewPrompt([makeThread()], [], "approve");
    expect(result).toContain("## Review Result: Approve");
    expect(result).toContain("### Summary");
    expect(result).toContain("LGTM");
  });

  it("formats verdict=request_changes with Request Changes header", () => {
    const result = formatReviewPrompt([makeThread()], [], "request_changes");
    expect(result).toContain("## Review Result: Request Changes");
    expect(result).toContain("### Summary");
    expect(result).toContain("Please address the above comments");
  });

  it("formats verdict=null with Comments header and no summary", () => {
    const result = formatReviewPrompt([makeThread()], [], null);
    expect(result).toContain("## Review Result: Comments");
    expect(result).not.toContain("### Summary");
  });
});
