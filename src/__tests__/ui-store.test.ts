import { describe, it, expect, beforeEach } from "vitest";
import { useUiStore } from "../store/uiStore";

beforeEach(() => {
  useUiStore.setState({
    displayMode: "split",
    rightPaneMode: "docs",
    diffLayout: "split",
    diffOverflow: "scroll",
    expandUnchanged: false,
    tocOpen: false,
    markdownViewMode: "preview",
  });
});

describe("useUiStore", () => {
  it("has correct initial state", () => {
    const s = useUiStore.getState();
    expect(s.displayMode).toBe("split");
    expect(s.rightPaneMode).toBe("docs");
    expect(s.diffLayout).toBe("split");
    expect(s.diffOverflow).toBe("scroll");
    expect(s.expandUnchanged).toBe(false);
    expect(s.tocOpen).toBe(false);
    expect(s.markdownViewMode).toBe("preview");
  });

  it("setDisplayMode changes display mode", () => {
    useUiStore.getState().setDisplayMode("diff");
    expect(useUiStore.getState().displayMode).toBe("diff");
  });

  it("setDisplayMode changes to viewer mode", () => {
    useUiStore.getState().setDisplayMode("viewer");
    expect(useUiStore.getState().displayMode).toBe("viewer");
  });

  it("setRightPaneMode switches right pane content", () => {
    useUiStore.getState().setRightPaneMode("terminal");
    expect(useUiStore.getState().rightPaneMode).toBe("terminal");
    useUiStore.getState().setRightPaneMode("review");
    expect(useUiStore.getState().rightPaneMode).toBe("review");
    useUiStore.getState().setRightPaneMode("docs");
    expect(useUiStore.getState().rightPaneMode).toBe("docs");
  });

  it("setDiffLayout toggles between split and unified", () => {
    useUiStore.getState().setDiffLayout("unified");
    expect(useUiStore.getState().diffLayout).toBe("unified");
    useUiStore.getState().setDiffLayout("split");
    expect(useUiStore.getState().diffLayout).toBe("split");
  });

  it("setDiffOverflow toggles between scroll and wrap", () => {
    useUiStore.getState().setDiffOverflow("wrap");
    expect(useUiStore.getState().diffOverflow).toBe("wrap");
  });

  it("setExpandUnchanged toggles expand state", () => {
    useUiStore.getState().setExpandUnchanged(true);
    expect(useUiStore.getState().expandUnchanged).toBe(true);
  });

  it("setTocOpen toggles table of contents", () => {
    useUiStore.getState().setTocOpen(true);
    expect(useUiStore.getState().tocOpen).toBe(true);
  });

  it("setMarkdownViewMode toggles between preview and raw", () => {
    useUiStore.getState().setMarkdownViewMode("raw");
    expect(useUiStore.getState().markdownViewMode).toBe("raw");
  });
});
