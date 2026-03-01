import { create } from "zustand";

interface DocState {
  // Document files
  docFiles: string[];
  setDocFiles: (files: string[]) => void;
  designDocs: string[];
  setDesignDocs: (docs: string[]) => void;

  // Selected document
  selectedDoc: string | null;
  setSelectedDoc: (path: string | null) => void;
  docContent: string | null;
  setDocContent: (content: string | null) => void;
  docSource: "repo" | "design" | "external";
  setDocSource: (source: "repo" | "design" | "external") => void;

  // Loading state
  isDocLoading: boolean;
  setIsDocLoading: (loading: boolean) => void;

  // External folders
  externalFolders: string[];
  addExternalFolder: (folder: string) => void;
  removeExternalFolder: (folder: string) => void;
  externalDocs: Record<string, string[]>;
  setExternalDocs: (folder: string, files: string[]) => void;
}

export const useDocStore = create<DocState>((set) => ({
  docFiles: [],
  setDocFiles: (files) => set({ docFiles: files }),
  designDocs: [],
  setDesignDocs: (docs) => set({ designDocs: docs }),

  selectedDoc: null,
  setSelectedDoc: (path) => set({ selectedDoc: path }),
  docContent: null,
  setDocContent: (content) => set({ docContent: content }),
  docSource: "repo",
  setDocSource: (source) => set({ docSource: source }),

  isDocLoading: false,
  setIsDocLoading: (loading) => set({ isDocLoading: loading }),

  externalFolders: [],
  addExternalFolder: (folder) =>
    set((state) => {
      if (state.externalFolders.includes(folder)) return state;
      return { externalFolders: [...state.externalFolders, folder] };
    }),
  removeExternalFolder: (folder) =>
    set((state) => ({
      externalFolders: state.externalFolders.filter((f) => f !== folder),
      externalDocs: Object.fromEntries(
        Object.entries(state.externalDocs).filter(([k]) => k !== folder),
      ),
    })),
  externalDocs: {},
  setExternalDocs: (folder, files) =>
    set((state) => ({
      externalDocs: { ...state.externalDocs, [folder]: files },
    })),
}));
