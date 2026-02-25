import { describe, it, expect } from "vitest";
import {
  getCodeSnippet,
  formatLineRef,
  getFileName,
  getFileDir,
  getStatusColor,
  getStatusLabel,
  generateGitPatch,
} from "../utils/diff-utils";
import type { FileDiff } from "../types";

// --- getCodeSnippet ---------------------------------------------------------

function makeFileDiff(overrides: Partial<FileDiff> = {}): FileDiff {
  return {
    file: {
      path: "src/foo.ts",
      old_path: null,
      status: "modified",
      additions: 2,
      deletions: 1,
      is_binary: false,
      is_generated: false,
    },
    hunks: [],
    old_content: null,
    new_content: null,
    ...overrides,
  };
}

describe("getCodeSnippet", () => {
  it("extracts a single line from new_content (1-indexed)", () => {
    const diff = makeFileDiff({ new_content: "line1\nline2\nline3" });
    expect(getCodeSnippet(diff, 2, 2)).toBe("line2");
  });

  it("extracts a multi-line range from new_content", () => {
    const diff = makeFileDiff({
      new_content: "a\nb\nc\nd\ne",
    });
    expect(getCodeSnippet(diff, 2, 4)).toBe("b\nc\nd");
  });

  it("extracts the first line from new_content", () => {
    const diff = makeFileDiff({ new_content: "first\nsecond" });
    expect(getCodeSnippet(diff, 1, 1)).toBe("first");
  });

  it("extracts the last line from new_content", () => {
    const diff = makeFileDiff({ new_content: "a\nb\nc" });
    expect(getCodeSnippet(diff, 3, 3)).toBe("c");
  });

  it("returns empty string for out-of-range lines from new_content", () => {
    const diff = makeFileDiff({ new_content: "a\nb" });
    expect(getCodeSnippet(diff, 5, 5)).toBe("");
  });

  it("falls back to hunk data when new_content is null", () => {
    const diff = makeFileDiff({
      new_content: null,
      hunks: [
        {
          header: "@@ -1,3 +1,3 @@",
          old_start: 1,
          old_lines: 3,
          new_start: 1,
          new_lines: 3,
          lines: [
            { origin: " ", old_lineno: 1, new_lineno: 1, content: "unchanged" },
            { origin: "-", old_lineno: 2, new_lineno: null, content: "old line" },
            { origin: "+", old_lineno: null, new_lineno: 2, content: "new line" },
            { origin: " ", old_lineno: 3, new_lineno: 3, content: "end" },
          ],
        },
      ],
    });
    // Deleted lines (new_lineno=null) are skipped; only new-side lines included
    expect(getCodeSnippet(diff, 1, 3)).toBe("unchanged\nnew line\nend");
  });

  it("skips deleted lines (new_lineno=null) in hunk fallback", () => {
    const diff = makeFileDiff({
      new_content: null,
      hunks: [
        {
          header: "@@ -1,2 +0,0 @@",
          old_start: 1,
          old_lines: 2,
          new_start: 0,
          new_lines: 0,
          lines: [
            { origin: "-", old_lineno: 1, new_lineno: null, content: "deleted1" },
            { origin: "-", old_lineno: 2, new_lineno: null, content: "deleted2" },
          ],
        },
      ],
    });
    // All lines are deletions (new_lineno=null), so nothing matches
    expect(getCodeSnippet(diff, 1, 2)).toBe("");
  });

  it("returns empty string for empty hunks when new_content is null", () => {
    const diff = makeFileDiff({ new_content: null, hunks: [] });
    expect(getCodeSnippet(diff, 1, 1)).toBe("");
  });

  it("extracts lines across multiple hunks", () => {
    const diff = makeFileDiff({
      new_content: null,
      hunks: [
        {
          header: "@@ -1,2 +1,2 @@",
          old_start: 1,
          old_lines: 2,
          new_start: 1,
          new_lines: 2,
          lines: [
            { origin: " ", old_lineno: 1, new_lineno: 1, content: "first" },
            { origin: " ", old_lineno: 2, new_lineno: 2, content: "second" },
          ],
        },
        {
          header: "@@ -10,2 +10,2 @@",
          old_start: 10,
          old_lines: 2,
          new_start: 10,
          new_lines: 2,
          lines: [
            { origin: " ", old_lineno: 10, new_lineno: 10, content: "tenth" },
            { origin: " ", old_lineno: 11, new_lineno: 11, content: "eleventh" },
          ],
        },
      ],
    });
    expect(getCodeSnippet(diff, 10, 11)).toBe("tenth\neleventh");
  });

  it("handles content with trailing newlines via cleanLastNewline", () => {
    const diff = makeFileDiff({
      new_content: null,
      hunks: [
        {
          header: "@@ -1,1 +1,1 @@",
          old_start: 1,
          old_lines: 1,
          new_start: 1,
          new_lines: 1,
          lines: [
            { origin: "+", old_lineno: null, new_lineno: 1, content: "content with newline\n" },
          ],
        },
      ],
    });
    // cleanLastNewline removes trailing \n
    expect(getCodeSnippet(diff, 1, 1)).toBe("content with newline");
  });
});

// --- formatLineRef ----------------------------------------------------------

describe("formatLineRef", () => {
  it("returns Lx for equal start/end", () => {
    expect(formatLineRef(1, 1)).toBe("L1");
    expect(formatLineRef(42, 42)).toBe("L42");
  });

  it("returns Lx-y for different start/end", () => {
    expect(formatLineRef(10, 15)).toBe("L10-15");
    expect(formatLineRef(1, 100)).toBe("L1-100");
  });
});

// --- getFileName / getFileDir -----------------------------------------------

describe("getFileName", () => {
  it("returns the last path segment", () => {
    expect(getFileName("src/components/App.tsx")).toBe("App.tsx");
  });

  it("returns the name itself for a single-segment path", () => {
    expect(getFileName("README.md")).toBe("README.md");
  });

  it("returns empty string for trailing slash path", () => {
    expect(getFileName("src/components/")).toBe("");
  });

  it("handles deeply nested paths", () => {
    expect(getFileName("a/b/c/d/e/f.ts")).toBe("f.ts");
  });
});

describe("getFileDir", () => {
  it("returns directory for a nested path", () => {
    expect(getFileDir("src/components/App.tsx")).toBe("src/components");
  });

  it("returns empty string for a single-segment path", () => {
    expect(getFileDir("README.md")).toBe("");
  });

  it("returns parent path for trailing slash", () => {
    expect(getFileDir("src/components/")).toBe("src/components");
  });

  it("handles deeply nested paths", () => {
    expect(getFileDir("a/b/c/d/e/f.ts")).toBe("a/b/c/d/e");
  });
});

// --- getStatusColor / getStatusLabel ----------------------------------------

describe("getStatusColor", () => {
  it("returns correct color for each known status", () => {
    expect(getStatusColor("added")).toBe("var(--color-added)");
    expect(getStatusColor("deleted")).toBe("var(--color-deleted)");
    expect(getStatusColor("modified")).toBe("var(--color-modified)");
    expect(getStatusColor("renamed")).toBe("var(--color-renamed)");
    expect(getStatusColor("copied")).toBe("var(--color-text-secondary)");
  });

  it("returns fallback for unknown status", () => {
    expect(getStatusColor("xyz")).toBe("var(--color-text-secondary)");
    expect(getStatusColor("")).toBe("var(--color-text-secondary)");
  });
});

describe("getStatusLabel", () => {
  it("returns correct label for each known status", () => {
    expect(getStatusLabel("added")).toBe("A");
    expect(getStatusLabel("deleted")).toBe("D");
    expect(getStatusLabel("modified")).toBe("M");
    expect(getStatusLabel("renamed")).toBe("R");
    expect(getStatusLabel("copied")).toBe("C");
  });

  it("returns ? for unknown status", () => {
    expect(getStatusLabel("xyz")).toBe("?");
    expect(getStatusLabel("")).toBe("?");
  });
});

// --- generateGitPatch -------------------------------------------------------

describe("generateGitPatch", () => {
  it("generates patch for a modified file", () => {
    const diff = makeFileDiff({
      hunks: [
        {
          header: "@@ -1,3 +1,4 @@",
          old_start: 1,
          old_lines: 3,
          new_start: 1,
          new_lines: 4,
          lines: [
            { origin: " ", old_lineno: 1, new_lineno: 1, content: "unchanged" },
            { origin: "-", old_lineno: 2, new_lineno: null, content: "old" },
            { origin: "+", old_lineno: null, new_lineno: 2, content: "new" },
            { origin: "+", old_lineno: null, new_lineno: 3, content: "extra" },
            { origin: " ", old_lineno: 3, new_lineno: 4, content: "end" },
          ],
        },
      ],
    });
    const patch = generateGitPatch(diff);
    expect(patch).toContain("diff --git a/src/foo.ts b/src/foo.ts");
    expect(patch).toContain("--- a/src/foo.ts");
    expect(patch).toContain("+++ b/src/foo.ts");
    expect(patch).toContain("@@ -1,3 +1,4 @@");
    expect(patch).toContain(" unchanged");
    expect(patch).toContain("-old");
    expect(patch).toContain("+new");
    expect(patch).toContain("+extra");
    expect(patch).toContain(" end");
  });

  it("generates patch for an added file", () => {
    const diff = makeFileDiff({
      file: {
        path: "src/new-file.ts",
        old_path: null,
        status: "added",
        additions: 2,
        deletions: 0,
        is_binary: false,
        is_generated: false,
      },
      hunks: [
        {
          header: "@@ -0,0 +1,2 @@",
          old_start: 0,
          old_lines: 0,
          new_start: 1,
          new_lines: 2,
          lines: [
            { origin: "+", old_lineno: null, new_lineno: 1, content: "line1" },
            { origin: "+", old_lineno: null, new_lineno: 2, content: "line2" },
          ],
        },
      ],
    });
    const patch = generateGitPatch(diff);
    expect(patch).toContain("diff --git a/src/new-file.ts b/src/new-file.ts");
    expect(patch).toContain("new file mode 100644");
    expect(patch).toContain("--- /dev/null");
    expect(patch).toContain("+++ b/src/new-file.ts");
    expect(patch).toContain("+line1");
    expect(patch).toContain("+line2");
  });

  it("generates patch for a deleted file", () => {
    const diff = makeFileDiff({
      file: {
        path: "src/old.ts",
        old_path: null,
        status: "deleted",
        additions: 0,
        deletions: 3,
        is_binary: false,
        is_generated: false,
      },
      hunks: [
        {
          header: "@@ -1,3 +0,0 @@",
          old_start: 1,
          old_lines: 3,
          new_start: 0,
          new_lines: 0,
          lines: [
            { origin: "-", old_lineno: 1, new_lineno: null, content: "a" },
            { origin: "-", old_lineno: 2, new_lineno: null, content: "b" },
            { origin: "-", old_lineno: 3, new_lineno: null, content: "c" },
          ],
        },
      ],
    });
    const patch = generateGitPatch(diff);
    expect(patch).toContain("diff --git a/src/old.ts b/src/old.ts");
    expect(patch).toContain("deleted file mode 100644");
    expect(patch).toContain("--- a/src/old.ts");
    expect(patch).toContain("+++ /dev/null");
    expect(patch).toContain("-a");
    expect(patch).toContain("-b");
    expect(patch).toContain("-c");
  });

  it("generates patch for a renamed file", () => {
    const diff = makeFileDiff({
      file: {
        path: "src/clipboard.ts",
        old_path: "src/copy-utils.ts",
        status: "renamed",
        additions: 1,
        deletions: 1,
        is_binary: false,
        is_generated: false,
      },
      hunks: [
        {
          header: "@@ -1,1 +1,1 @@",
          old_start: 1,
          old_lines: 1,
          new_start: 1,
          new_lines: 1,
          lines: [
            { origin: "-", old_lineno: 1, new_lineno: null, content: "old name" },
            { origin: "+", old_lineno: null, new_lineno: 1, content: "new name" },
          ],
        },
      ],
    });
    const patch = generateGitPatch(diff);
    expect(patch).toContain("diff --git a/src/copy-utils.ts b/src/clipboard.ts");
    expect(patch).toContain("rename from src/copy-utils.ts");
    expect(patch).toContain("rename to src/clipboard.ts");
    expect(patch).toContain("--- a/src/copy-utils.ts");
    expect(patch).toContain("+++ b/src/clipboard.ts");
  });

  it("uses path as old_path fallback when old_path is null", () => {
    const diff = makeFileDiff({
      file: {
        path: "src/foo.ts",
        old_path: null,
        status: "modified",
        additions: 1,
        deletions: 0,
        is_binary: false,
        is_generated: false,
      },
      hunks: [],
    });
    const patch = generateGitPatch(diff);
    expect(patch).toContain("diff --git a/src/foo.ts b/src/foo.ts");
    expect(patch).toContain("--- a/src/foo.ts");
  });

  it("generates patch with multiple hunks", () => {
    const diff = makeFileDiff({
      hunks: [
        {
          header: "@@ -1,2 +1,2 @@",
          old_start: 1,
          old_lines: 2,
          new_start: 1,
          new_lines: 2,
          lines: [
            { origin: "-", old_lineno: 1, new_lineno: null, content: "old1" },
            { origin: "+", old_lineno: null, new_lineno: 1, content: "new1" },
          ],
        },
        {
          header: "@@ -10,2 +10,2 @@",
          old_start: 10,
          old_lines: 2,
          new_start: 10,
          new_lines: 2,
          lines: [
            { origin: "-", old_lineno: 10, new_lineno: null, content: "old10" },
            { origin: "+", old_lineno: null, new_lineno: 10, content: "new10" },
          ],
        },
      ],
    });
    const patch = generateGitPatch(diff);
    expect(patch).toContain("@@ -1,2 +1,2 @@");
    expect(patch).toContain("@@ -10,2 +10,2 @@");
    expect(patch).toContain("-old1");
    expect(patch).toContain("+new1");
    expect(patch).toContain("-old10");
    expect(patch).toContain("+new10");
  });

  it("handles empty hunks", () => {
    const diff = makeFileDiff({ hunks: [] });
    const patch = generateGitPatch(diff);
    // Should have header lines but no hunk content
    expect(patch).toContain("diff --git");
    expect(patch).toContain("---");
    expect(patch).toContain("+++");
  });
});
