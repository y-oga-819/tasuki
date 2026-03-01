import { describe, it, expect, beforeEach } from "vitest";
import { useDocStore } from "../store/docStore";

beforeEach(() => {
  useDocStore.setState({
    docFiles: [],
    designDocs: [],
    selectedDoc: null,
    docContent: null,
    docSource: "repo",
    isDocLoading: false,
    externalFolders: [],
    externalDocs: {},
  });
});

describe("useDocStore", () => {
  it("has correct initial state", () => {
    const s = useDocStore.getState();
    expect(s.docFiles).toEqual([]);
    expect(s.designDocs).toEqual([]);
    expect(s.selectedDoc).toBeNull();
    expect(s.docContent).toBeNull();
    expect(s.docSource).toBe("repo");
    expect(s.isDocLoading).toBe(false);
    expect(s.externalFolders).toEqual([]);
    expect(s.externalDocs).toEqual({});
  });

  it("setDocFiles and setDesignDocs set file lists", () => {
    useDocStore.getState().setDocFiles(["a.md", "b.md"]);
    expect(useDocStore.getState().docFiles).toEqual(["a.md", "b.md"]);

    useDocStore.getState().setDesignDocs(["design.md"]);
    expect(useDocStore.getState().designDocs).toEqual(["design.md"]);
  });

  it("setDocSource switches between repo, design, and external", () => {
    useDocStore.getState().setDocSource("design");
    expect(useDocStore.getState().docSource).toBe("design");
    useDocStore.getState().setDocSource("external");
    expect(useDocStore.getState().docSource).toBe("external");
  });

  it("setSelectedDoc sets and clears selected doc", () => {
    useDocStore.getState().setSelectedDoc("architecture.md");
    expect(useDocStore.getState().selectedDoc).toBe("architecture.md");

    useDocStore.getState().setSelectedDoc(null);
    expect(useDocStore.getState().selectedDoc).toBeNull();
  });

  it("setDocContent sets and clears doc content", () => {
    useDocStore.getState().setDocContent("# Architecture\nSome content");
    expect(useDocStore.getState().docContent).toBe("# Architecture\nSome content");

    useDocStore.getState().setDocContent(null);
    expect(useDocStore.getState().docContent).toBeNull();
  });

  it("addExternalFolder adds a folder without duplicates", () => {
    useDocStore.getState().addExternalFolder("/home/docs");
    expect(useDocStore.getState().externalFolders).toEqual(["/home/docs"]);

    useDocStore.getState().addExternalFolder("/home/docs");
    expect(useDocStore.getState().externalFolders).toEqual(["/home/docs"]);

    useDocStore.getState().addExternalFolder("/other");
    expect(useDocStore.getState().externalFolders).toEqual(["/home/docs", "/other"]);
  });

  it("removeExternalFolder removes folder and its docs", () => {
    useDocStore.getState().addExternalFolder("/home/docs");
    useDocStore.getState().setExternalDocs("/home/docs", ["a.md"]);
    useDocStore.getState().removeExternalFolder("/home/docs");
    expect(useDocStore.getState().externalFolders).toEqual([]);
    expect(useDocStore.getState().externalDocs).toEqual({});
  });

  it("setExternalDocs sets files for a folder", () => {
    useDocStore.getState().setExternalDocs("/docs", ["a.md", "b.md"]);
    expect(useDocStore.getState().externalDocs).toEqual({ "/docs": ["a.md", "b.md"] });
  });

  it("setIsDocLoading toggles loading state", () => {
    useDocStore.getState().setIsDocLoading(true);
    expect(useDocStore.getState().isDocLoading).toBe(true);
    useDocStore.getState().setIsDocLoading(false);
    expect(useDocStore.getState().isDocLoading).toBe(false);
  });
});
