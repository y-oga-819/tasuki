import { describe, it, expect, beforeEach } from "vitest";
import { useDisplayStore } from "../store/displayStore";

beforeEach(() => {
  useDisplayStore.setState({
    displayMode: "split",
    rightPaneMode: "docs",
    diffLayout: "split",
    diffOverflow: "scroll",
    expandUnchanged: false,
    tocOpen: false,
    markdownViewMode: "preview",
  });
});

describe("useDisplayStore", () => {
  it("has correct initial state", () => {
    const s = useDisplayStore.getState();
    expect(s.displayMode).toBe("split");
    expect(s.rightPaneMode).toBe("docs");
    expect(s.diffLayout).toBe("split");
    expect(s.diffOverflow).toBe("scroll");
    expect(s.expandUnchanged).toBe(false);
    expect(s.tocOpen).toBe(false);
    expect(s.markdownViewMode).toBe("preview");
  });

  it("setDisplayMode changes display mode", () => {
    useDisplayStore.getState().setDisplayMode("diff");
    expect(useDisplayStore.getState().displayMode).toBe("diff");
  });

  it("setDisplayMode changes to viewer mode", () => {
    useDisplayStore.getState().setDisplayMode("viewer");
    expect(useDisplayStore.getState().displayMode).toBe("viewer");
  });

  it("setRightPaneMode switches right pane content", () => {
    useDisplayStore.getState().setRightPaneMode("terminal");
    expect(useDisplayStore.getState().rightPaneMode).toBe("terminal");
    useDisplayStore.getState().setRightPaneMode("review");
    expect(useDisplayStore.getState().rightPaneMode).toBe("review");
    useDisplayStore.getState().setRightPaneMode("docs");
    expect(useDisplayStore.getState().rightPaneMode).toBe("docs");
  });

  it("setDiffLayout toggles between split and unified", () => {
    useDisplayStore.getState().setDiffLayout("unified");
    expect(useDisplayStore.getState().diffLayout).toBe("unified");
    useDisplayStore.getState().setDiffLayout("split");
    expect(useDisplayStore.getState().diffLayout).toBe("split");
  });

  it("setDiffOverflow toggles between scroll and wrap", () => {
    useDisplayStore.getState().setDiffOverflow("wrap");
    expect(useDisplayStore.getState().diffOverflow).toBe("wrap");
  });

  it("setExpandUnchanged toggles expand state", () => {
    useDisplayStore.getState().setExpandUnchanged(true);
    expect(useDisplayStore.getState().expandUnchanged).toBe(true);
  });

  it("setTocOpen toggles table of contents", () => {
    useDisplayStore.getState().setTocOpen(true);
    expect(useDisplayStore.getState().tocOpen).toBe(true);
  });

  it("setMarkdownViewMode toggles between preview and raw", () => {
    useDisplayStore.getState().setMarkdownViewMode("raw");
    expect(useDisplayStore.getState().markdownViewMode).toBe("raw");
  });
});
