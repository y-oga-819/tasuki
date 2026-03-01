import { describe, it, expect, beforeEach } from "vitest";
import { useEditorStore } from "../store/editorStore";
import type { CommentFormTarget } from "../store/editorStore";

beforeEach(() => {
  useEditorStore.setState({
    lineSelection: null,
    commentFormTarget: null,
    searchQuery: "",
    searchMatches: 0,
  });
});

describe("useEditorStore", () => {
  it("has correct initial state", () => {
    const s = useEditorStore.getState();
    expect(s.lineSelection).toBeNull();
    expect(s.commentFormTarget).toBeNull();
    expect(s.searchQuery).toBe("");
    expect(s.searchMatches).toBe(0);
  });

  it("setLineSelection sets unified selection object", () => {
    const range = { start: 10, end: 15 };
    useEditorStore.getState().setLineSelection(range, "src/foo.ts");
    const s = useEditorStore.getState();
    expect(s.lineSelection).toEqual({ file: "src/foo.ts", range });
  });

  it("setLineSelection returns null when file is not provided", () => {
    useEditorStore.getState().setLineSelection({ start: 1, end: 1 });
    expect(useEditorStore.getState().lineSelection).toBeNull();
  });

  it("setLineSelection clears selection with null", () => {
    useEditorStore.getState().setLineSelection({ start: 5, end: 10 }, "src/foo.ts");
    useEditorStore.getState().setLineSelection(null);
    const s = useEditorStore.getState();
    expect(s.lineSelection).toBeNull();
  });

  it("setSearchQuery persists search state across calls", () => {
    useEditorStore.getState().setSearchQuery("hello");
    expect(useEditorStore.getState().searchQuery).toBe("hello");
    useEditorStore.getState().setSearchQuery("");
    expect(useEditorStore.getState().searchQuery).toBe("");
  });

  it("setSearchMatches updates match count", () => {
    useEditorStore.getState().setSearchMatches(42);
    expect(useEditorStore.getState().searchMatches).toBe(42);
  });

  it("setCommentFormTarget sets and clears target", () => {
    const target: CommentFormTarget = {
      filePath: "src/App.tsx",
      lineNumber: 10,
      side: "additions",
      selectionStart: 10,
      selectionEnd: 15,
    };
    useEditorStore.getState().setCommentFormTarget(target);
    expect(useEditorStore.getState().commentFormTarget).toEqual(target);

    useEditorStore.getState().setCommentFormTarget(null);
    expect(useEditorStore.getState().commentFormTarget).toBeNull();
  });
});
