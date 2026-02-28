import { create } from "zustand";
import type { DisplayMode, RightPaneMode, DiffLayout } from "../types";

/** Overflow mode for diff lines (Pierre-native) */
export type DiffOverflow = "scroll" | "wrap";

interface DisplayState {
  displayMode: DisplayMode;
  setDisplayMode: (mode: DisplayMode) => void;
  rightPaneMode: RightPaneMode;
  setRightPaneMode: (mode: RightPaneMode) => void;
  diffLayout: DiffLayout;
  setDiffLayout: (layout: DiffLayout) => void;
  diffOverflow: DiffOverflow;
  setDiffOverflow: (overflow: DiffOverflow) => void;
  expandUnchanged: boolean;
  setExpandUnchanged: (expand: boolean) => void;
  tocOpen: boolean;
  setTocOpen: (open: boolean) => void;
  markdownViewMode: "preview" | "raw";
  setMarkdownViewMode: (mode: "preview" | "raw") => void;
}

export const useDisplayStore = create<DisplayState>((set) => ({
  displayMode: "split",
  setDisplayMode: (mode) => set({ displayMode: mode }),
  rightPaneMode: "docs",
  setRightPaneMode: (mode) => set({ rightPaneMode: mode }),
  diffLayout: "split",
  setDiffLayout: (layout) => set({ diffLayout: layout }),
  diffOverflow: "scroll",
  setDiffOverflow: (overflow) => set({ diffOverflow: overflow }),
  expandUnchanged: false,
  setExpandUnchanged: (expand) => set({ expandUnchanged: expand }),
  tocOpen: false,
  setTocOpen: (open) => set({ tocOpen: open }),
  markdownViewMode: "preview",
  setMarkdownViewMode: (mode) => set({ markdownViewMode: mode }),
}));
