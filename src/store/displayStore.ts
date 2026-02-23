import { create } from "zustand";
import type { DisplayMode, DiffLayout } from "../types";

/** Overflow mode for diff lines (Pierre-native) */
export type DiffOverflow = "scroll" | "wrap";

interface DisplayState {
  displayMode: DisplayMode;
  setDisplayMode: (mode: DisplayMode) => void;
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
  displayMode: "diff-docs",
  setDisplayMode: (mode) => set({ displayMode: mode }),
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
