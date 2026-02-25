import { describe, it, expect, beforeEach } from "vitest";
import { useDiffStore } from "../store/diffStore";
import type { DiffResult, CommentFormTarget } from "../store/diffStore";

beforeEach(() => {
  useDiffStore.setState({
    diffResult: null,
    diffSource: { type: "uncommitted" },
    selectedFile: null,
    docFiles: [],
    selectedDoc: null,
    docContent: null,
    collapsedFiles: new Set<string>(),
    designDocs: [],
    docSource: "repo",
    selectedLineRange: null,
    selectedLineFile: null,
    commentFormTarget: null,
    isLoading: false,
    error: null,
    repoPath: "",
    repoInfo: null,
  });
});

const mockDiffResult: DiffResult = {
  files: [],
  stats: { files_changed: 0, additions: 0, deletions: 0 },
};

describe("useDiffStore", () => {
  it("has correct initial state", () => {
    const s = useDiffStore.getState();
    expect(s.diffResult).toBeNull();
    expect(s.diffSource).toEqual({ type: "uncommitted" });
    expect(s.selectedFile).toBeNull();
    expect(s.isLoading).toBe(false);
    expect(s.error).toBeNull();
    expect(s.repoPath).toBe("");
    expect(s.repoInfo).toBeNull();
  });

  it("setDiffResult sets the diff result", () => {
    useDiffStore.getState().setDiffResult(mockDiffResult);
    expect(useDiffStore.getState().diffResult).toEqual(mockDiffResult);
  });

  it("setDiffSource changes diff source", () => {
    useDiffStore.getState().setDiffSource({ type: "staged" });
    expect(useDiffStore.getState().diffSource).toEqual({ type: "staged" });
  });

  it("setSelectedFile sets selected file path", () => {
    useDiffStore.getState().setSelectedFile("src/App.tsx");
    expect(useDiffStore.getState().selectedFile).toBe("src/App.tsx");
  });

  it("toggleFileCollapse adds and removes from collapsed set", () => {
    const path = "src/App.tsx";
    useDiffStore.getState().toggleFileCollapse(path);
    expect(useDiffStore.getState().collapsedFiles.has(path)).toBe(true);

    useDiffStore.getState().toggleFileCollapse(path);
    expect(useDiffStore.getState().collapsedFiles.has(path)).toBe(false);
  });

  it("toggleFileCollapse creates new Set (immutable update)", () => {
    const path = "src/App.tsx";
    const before = useDiffStore.getState().collapsedFiles;
    useDiffStore.getState().toggleFileCollapse(path);
    const after = useDiffStore.getState().collapsedFiles;
    expect(before).not.toBe(after);
  });

  it("setDocFiles and setDesignDocs set file lists", () => {
    useDiffStore.getState().setDocFiles(["a.md", "b.md"]);
    expect(useDiffStore.getState().docFiles).toEqual(["a.md", "b.md"]);

    useDiffStore.getState().setDesignDocs(["design.md"]);
    expect(useDiffStore.getState().designDocs).toEqual(["design.md"]);
  });

  it("setDocSource switches between repo and design", () => {
    useDiffStore.getState().setDocSource("design");
    expect(useDiffStore.getState().docSource).toBe("design");
  });

  it("setSelectedLineRange sets range and file", () => {
    const range = { start: 10, end: 15 };
    useDiffStore.getState().setSelectedLineRange(range, "src/foo.ts");
    const s = useDiffStore.getState();
    expect(s.selectedLineRange).toEqual(range);
    expect(s.selectedLineFile).toBe("src/foo.ts");
  });

  it("setSelectedLineRange defaults file to null", () => {
    useDiffStore.getState().setSelectedLineRange({ start: 1, end: 1 });
    expect(useDiffStore.getState().selectedLineFile).toBeNull();
  });

  it("setCommentFormTarget sets and clears target", () => {
    const target: CommentFormTarget = {
      filePath: "src/App.tsx",
      lineNumber: 10,
      side: "additions",
      selectionStart: 10,
      selectionEnd: 15,
    };
    useDiffStore.getState().setCommentFormTarget(target);
    expect(useDiffStore.getState().commentFormTarget).toEqual(target);

    useDiffStore.getState().setCommentFormTarget(null);
    expect(useDiffStore.getState().commentFormTarget).toBeNull();
  });

  it("setIsLoading and setError manage loading state", () => {
    useDiffStore.getState().setIsLoading(true);
    expect(useDiffStore.getState().isLoading).toBe(true);

    useDiffStore.getState().setError("Something went wrong");
    expect(useDiffStore.getState().error).toBe("Something went wrong");
  });

  it("setRepoPath and setRepoInfo set repo info", () => {
    useDiffStore.getState().setRepoPath("/home/user/project");
    expect(useDiffStore.getState().repoPath).toBe("/home/user/project");

    const info = { repo_name: "test", branch_name: "main", is_worktree: false };
    useDiffStore.getState().setRepoInfo(info);
    expect(useDiffStore.getState().repoInfo).toEqual(info);
  });

  // --- Missing coverage: setSelectedDoc, setDocContent ----------------------

  it("setSelectedDoc sets and clears selected doc", () => {
    useDiffStore.getState().setSelectedDoc("architecture.md");
    expect(useDiffStore.getState().selectedDoc).toBe("architecture.md");

    useDiffStore.getState().setSelectedDoc(null);
    expect(useDiffStore.getState().selectedDoc).toBeNull();
  });

  it("setDocContent sets and clears doc content", () => {
    useDiffStore.getState().setDocContent("# Architecture\nSome content");
    expect(useDiffStore.getState().docContent).toBe("# Architecture\nSome content");

    useDiffStore.getState().setDocContent(null);
    expect(useDiffStore.getState().docContent).toBeNull();
  });

  // --- Edge cases -----------------------------------------------------------

  it("setSelectedLineRange clears range with null", () => {
    useDiffStore.getState().setSelectedLineRange({ start: 5, end: 10 }, "src/foo.ts");
    useDiffStore.getState().setSelectedLineRange(null);
    const s = useDiffStore.getState();
    expect(s.selectedLineRange).toBeNull();
    expect(s.selectedLineFile).toBeNull();
  });

  it("setDiffResult to null clears previous result", () => {
    useDiffStore.getState().setDiffResult(mockDiffResult);
    useDiffStore.getState().setDiffResult(null);
    expect(useDiffStore.getState().diffResult).toBeNull();
  });

  it("setError to null clears previous error", () => {
    useDiffStore.getState().setError("failure");
    useDiffStore.getState().setError(null);
    expect(useDiffStore.getState().error).toBeNull();
  });

  it("toggleFileCollapse handles multiple files independently", () => {
    useDiffStore.getState().toggleFileCollapse("a.ts");
    useDiffStore.getState().toggleFileCollapse("b.ts");
    const collapsed = useDiffStore.getState().collapsedFiles;
    expect(collapsed.has("a.ts")).toBe(true);
    expect(collapsed.has("b.ts")).toBe(true);

    useDiffStore.getState().toggleFileCollapse("a.ts");
    const after = useDiffStore.getState().collapsedFiles;
    expect(after.has("a.ts")).toBe(false);
    expect(after.has("b.ts")).toBe(true);
  });

  it("setSelectedFile to null clears selection", () => {
    useDiffStore.getState().setSelectedFile("src/App.tsx");
    useDiffStore.getState().setSelectedFile(null);
    expect(useDiffStore.getState().selectedFile).toBeNull();
  });

  it("setDiffSource supports all source types", () => {
    const sources = [
      { type: "uncommitted" as const },
      { type: "staged" as const },
      { type: "working" as const },
      { type: "commit" as const, ref: "abc123" },
      { type: "range" as const, from: "abc", to: "def" },
    ];
    for (const source of sources) {
      useDiffStore.getState().setDiffSource(source);
      expect(useDiffStore.getState().diffSource).toEqual(source);
    }
  });
});
