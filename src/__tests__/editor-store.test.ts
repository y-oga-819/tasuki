import { describe, it, expect, beforeEach } from "vitest";
import { useEditorStore } from "../store/editorStore";
import type { CommentFormTarget } from "../store/editorStore";

beforeEach(() => {
  useEditorStore.setState({
    selectedLineRange: null,
    selectedLineFile: null,
    commentFormTarget: null,
  });
});

describe("useEditorStore", () => {
  it("has correct initial state", () => {
    const s = useEditorStore.getState();
    expect(s.selectedLineRange).toBeNull();
    expect(s.selectedLineFile).toBeNull();
    expect(s.commentFormTarget).toBeNull();
  });

  it("setSelectedLineRange sets range and file", () => {
    const range = { start: 10, end: 15 };
    useEditorStore.getState().setSelectedLineRange(range, "src/foo.ts");
    const s = useEditorStore.getState();
    expect(s.selectedLineRange).toEqual(range);
    expect(s.selectedLineFile).toBe("src/foo.ts");
  });

  it("setSelectedLineRange defaults file to null", () => {
    useEditorStore.getState().setSelectedLineRange({ start: 1, end: 1 });
    expect(useEditorStore.getState().selectedLineFile).toBeNull();
  });

  it("setSelectedLineRange clears range with null", () => {
    useEditorStore.getState().setSelectedLineRange({ start: 5, end: 10 }, "src/foo.ts");
    useEditorStore.getState().setSelectedLineRange(null);
    const s = useEditorStore.getState();
    expect(s.selectedLineRange).toBeNull();
    expect(s.selectedLineFile).toBeNull();
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
