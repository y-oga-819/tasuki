import { create } from "zustand";
import type { DiffResult, MethodInspectionResult, CallHierarchyCall, InspectorProgress } from "../types";
import { lspAnalyzeDiff, type ChangedFileInfo } from "../utils/tauri-api";

/** UI card state extending the backend result */
export interface MethodCard extends MethodInspectionResult {
  definitionHtml: string | null;
  collapsed: boolean;
}

interface InspectorState {
  methods: MethodCard[];
  analyzing: boolean;
  progress: InspectorProgress;
  error: string | null;

  analyzeAll: (diffResult: DiffResult) => Promise<void>;
  updateMethodCallers: (index: number, callers: CallHierarchyCall[], callees: CallHierarchyCall[]) => void;
  updateProgress: (progress: InspectorProgress) => void;
  toggleCollapse: (index: number) => void;
  setDefinitionHtml: (index: number, html: string) => void;
  reset: () => void;
}

/** Extract changed file info from a DiffResult for the backend. */
function extractChangedFiles(diffResult: DiffResult): ChangedFileInfo[] {
  return diffResult.files.map((fileDiff) => {
    const addedLines: number[] = [];
    const deletedLines: number[] = [];

    for (const hunk of fileDiff.hunks) {
      for (const line of hunk.lines) {
        if (line.origin === "+" && line.new_lineno !== null) {
          addedLines.push(line.new_lineno - 1); // Convert to 0-based for LSP
        } else if (line.origin === "-" && line.old_lineno !== null) {
          deletedLines.push(line.old_lineno - 1); // Convert to 0-based for LSP
        }
      }
    }

    return {
      file_path: fileDiff.file.path,
      added_lines: addedLines,
      deleted_lines: deletedLines,
    };
  }).filter((f) => f.added_lines.length > 0 || f.deleted_lines.length > 0);
}

export const useInspectorStore = create<InspectorState>((set, get) => ({
  methods: [],
  analyzing: false,
  progress: { done: 0, total: 0 },
  error: null,

  analyzeAll: async (diffResult: DiffResult) => {
    set({ analyzing: true, error: null, methods: [], progress: { done: 0, total: 0 } });

    try {
      const changedFiles = extractChangedFiles(diffResult);
      if (changedFiles.length === 0) {
        set({ analyzing: false });
        return;
      }
      const results = await lspAnalyzeDiff(changedFiles);
      const cards: MethodCard[] = results.map((r) => ({
        ...r,
        definitionHtml: null,
        collapsed: false,
      }));
      set({ methods: cards, analyzing: false });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      set({ analyzing: false, error: message });
    }
  },

  updateMethodCallers: (index, callers, callees) => {
    const methods = [...get().methods];
    if (methods[index]) {
      methods[index] = { ...methods[index], callers, callees };
      set({ methods });
    }
  },

  updateProgress: (progress) => set({ progress }),

  toggleCollapse: (index) => {
    const methods = [...get().methods];
    if (methods[index]) {
      methods[index] = { ...methods[index], collapsed: !methods[index].collapsed };
      set({ methods });
    }
  },

  setDefinitionHtml: (index, html) => {
    const methods = [...get().methods];
    if (methods[index]) {
      methods[index] = { ...methods[index], definitionHtml: html };
      set({ methods });
    }
  },

  reset: () => set({ methods: [], analyzing: false, progress: { done: 0, total: 0 }, error: null }),
}));
