import { describe, it, expect, beforeEach } from "vitest";
import { useDisplayStore } from "../store/displayStore";

beforeEach(() => {
  useDisplayStore.setState({
    displayMode: "diff-docs",
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
    expect(s.displayMode).toBe("diff-docs");
    expect(s.diffLayout).toBe("split");
    expect(s.diffOverflow).toBe("scroll");
    expect(s.expandUnchanged).toBe(false);
    expect(s.tocOpen).toBe(false);
    expect(s.markdownViewMode).toBe("preview");
  });

  it("setDisplayMode changes display mode", () => {
    useDisplayStore.getState().setDisplayMode("terminal");
    expect(useDisplayStore.getState().displayMode).toBe("terminal");
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
