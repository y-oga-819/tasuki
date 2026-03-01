import { describe, it, expect, beforeEach } from "vitest";
import { useEditorStore } from "../store/editorStore";
import type { CommentFormTarget } from "../store/editorStore";

beforeEach(() => {
  useEditorStore.setState({
    lineSelection: null,
    commentFormTarget: null,
  });
});

describe("useEditorStore", () => {
  it("has correct initial state", () => {
    const s = useEditorStore.getState();
    expect(s.lineSelection).toBeNull();
    expect(s.commentFormTarget).toBeNull();
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
