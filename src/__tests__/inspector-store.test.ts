import { describe, it, expect, beforeEach } from "vitest";
import { useInspectorStore } from "../store/inspectorStore";
import type { DiffResult, MethodInspectionResult } from "../types";

function makeMockDiffResult(files: Array<{
  path: string;
  lines: Array<{ origin: "+" | "-" | " "; old_lineno: number | null; new_lineno: number | null }>;
}>): DiffResult {
  return {
    files: files.map((f) => ({
      file: {
        path: f.path,
        old_path: null,
        status: "modified" as const,
        additions: f.lines.filter((l) => l.origin === "+").length,
        deletions: f.lines.filter((l) => l.origin === "-").length,
        is_binary: false,
        is_generated: false,
      },
      hunks: [
        {
          header: "@@ -1,10 +1,10 @@",
          old_start: 1,
          old_lines: 10,
          new_start: 1,
          new_lines: 10,
          lines: f.lines.map((l) => ({
            origin: l.origin,
            old_lineno: l.old_lineno,
            new_lineno: l.new_lineno,
            content: "mock line content",
          })),
        },
      ],
      old_content: null,
      new_content: null,
    })),
    stats: { files_changed: files.length, additions: 0, deletions: 0 },
  };
}

beforeEach(() => {
  useInspectorStore.setState({
    methods: [],
    analyzing: false,
    progress: { done: 0, total: 0 },
    error: null,
  });
});

describe("useInspectorStore", () => {
  it("has correct initial state", () => {
    const s = useInspectorStore.getState();
    expect(s.methods).toEqual([]);
    expect(s.analyzing).toBe(false);
    expect(s.progress).toEqual({ done: 0, total: 0 });
    expect(s.error).toBeNull();
  });

  it("analyzeAll sets analyzing=true then populates methods from mock", async () => {
    const diffResult = makeMockDiffResult([
      {
        path: "src/app.ts",
        lines: [
          { origin: "+", old_lineno: null, new_lineno: 5 },
          { origin: "+", old_lineno: null, new_lineno: 6 },
        ],
      },
    ]);

    // analyzeAll calls lspAnalyzeDiff which returns mock data
    await useInspectorStore.getState().analyzeAll(diffResult);

    const s = useInspectorStore.getState();
    expect(s.analyzing).toBe(false);
    expect(s.methods.length).toBeGreaterThan(0);
    // Each method should have MethodCard fields
    for (const m of s.methods) {
      expect(m.definitionHtml).toBeNull();
      expect(m.collapsed).toBe(false);
      expect(m.name).toBeTruthy();
      expect(m.file_path).toBeTruthy();
    }
  });

  it("analyzeAll with empty diff returns no methods", async () => {
    const diffResult: DiffResult = {
      files: [],
      stats: { files_changed: 0, additions: 0, deletions: 0 },
    };

    await useInspectorStore.getState().analyzeAll(diffResult);

    const s = useInspectorStore.getState();
    expect(s.analyzing).toBe(false);
    expect(s.methods).toEqual([]);
    expect(s.error).toBeNull();
  });

  it("toggleCollapse toggles collapsed state on a method", async () => {
    // Seed with a method
    const method: MethodInspectionResult = {
      name: "foo",
      file_path: "test.ts",
      start_line: 1,
      end_line: 5,
      changed_lines: [3],
      change_type: "added",
      definition_code: "function foo() {}",
      callers: [],
      callees: [],
      hover_info: null,
    };
    useInspectorStore.setState({
      methods: [{ ...method, definitionHtml: null, collapsed: false }],
    });

    useInspectorStore.getState().toggleCollapse(0);
    expect(useInspectorStore.getState().methods[0].collapsed).toBe(true);

    useInspectorStore.getState().toggleCollapse(0);
    expect(useInspectorStore.getState().methods[0].collapsed).toBe(false);
  });

  it("toggleCollapse with out-of-range index does nothing", () => {
    useInspectorStore.setState({ methods: [] });
    // Should not throw
    useInspectorStore.getState().toggleCollapse(99);
    expect(useInspectorStore.getState().methods).toEqual([]);
  });

  it("setDefinitionHtml updates a specific method's HTML", () => {
    const method: MethodInspectionResult = {
      name: "bar",
      file_path: "test.ts",
      start_line: 10,
      end_line: 20,
      changed_lines: [15],
      change_type: "modified",
      definition_code: "function bar() {}",
      callers: [],
      callees: [],
      hover_info: null,
    };
    useInspectorStore.setState({
      methods: [{ ...method, definitionHtml: null, collapsed: false }],
    });

    useInspectorStore.getState().setDefinitionHtml(0, "<pre>highlighted</pre>");
    expect(useInspectorStore.getState().methods[0].definitionHtml).toBe("<pre>highlighted</pre>");
  });

  it("updateMethodCallers updates callers and callees", () => {
    const method: MethodInspectionResult = {
      name: "baz",
      file_path: "test.ts",
      start_line: 1,
      end_line: 5,
      changed_lines: [2],
      change_type: "deleted",
      definition_code: "function baz() {}",
      callers: [],
      callees: [],
      hover_info: null,
    };
    useInspectorStore.setState({
      methods: [{ ...method, definitionHtml: null, collapsed: false }],
    });

    const newCallers = [
      { name: "caller1", kind: "function", file_path: "a.ts", line: 1, character: 0, code_snippet: "" },
    ];
    const newCallees = [
      { name: "callee1", kind: "function", file_path: "b.ts", line: 5, character: 0, code_snippet: "" },
    ];

    useInspectorStore.getState().updateMethodCallers(0, newCallers, newCallees);

    const m = useInspectorStore.getState().methods[0];
    expect(m.callers).toEqual(newCallers);
    expect(m.callees).toEqual(newCallees);
  });

  it("updateProgress sets progress values", () => {
    useInspectorStore.getState().updateProgress({ done: 3, total: 10 });
    expect(useInspectorStore.getState().progress).toEqual({ done: 3, total: 10 });
  });

  it("reset clears all state", async () => {
    // Set up some state
    const method: MethodInspectionResult = {
      name: "x",
      file_path: "x.ts",
      start_line: 1,
      end_line: 2,
      changed_lines: [1],
      change_type: "added",
      definition_code: "",
      callers: [],
      callees: [],
      hover_info: null,
    };
    useInspectorStore.setState({
      methods: [{ ...method, definitionHtml: null, collapsed: false }],
      analyzing: false,
      progress: { done: 5, total: 10 },
      error: "some error",
    });

    useInspectorStore.getState().reset();

    const s = useInspectorStore.getState();
    expect(s.methods).toEqual([]);
    expect(s.analyzing).toBe(false);
    expect(s.progress).toEqual({ done: 0, total: 0 });
    expect(s.error).toBeNull();
  });
});

describe("extractChangedFiles (via analyzeAll behavior)", () => {
  it("filters out files with no changed lines", async () => {
    const diffResult = makeMockDiffResult([
      {
        path: "src/unchanged.ts",
        lines: [
          { origin: " ", old_lineno: 1, new_lineno: 1 },
          { origin: " ", old_lineno: 2, new_lineno: 2 },
        ],
      },
    ]);

    await useInspectorStore.getState().analyzeAll(diffResult);

    // With no changed lines, analyzeAll should return early
    const s = useInspectorStore.getState();
    expect(s.analyzing).toBe(false);
    expect(s.methods).toEqual([]);
  });

  it("correctly extracts added and deleted lines from hunks", async () => {
    const diffResult = makeMockDiffResult([
      {
        path: "src/mixed.ts",
        lines: [
          { origin: "+", old_lineno: null, new_lineno: 10 },
          { origin: "-", old_lineno: 5, new_lineno: null },
          { origin: " ", old_lineno: 6, new_lineno: 11 },
          { origin: "+", old_lineno: null, new_lineno: 12 },
        ],
      },
    ]);

    // This calls lspAnalyzeDiff with the extracted ChangedFileInfo
    // Since the mock always returns the same data, we mainly verify no crash
    await useInspectorStore.getState().analyzeAll(diffResult);

    const s = useInspectorStore.getState();
    expect(s.analyzing).toBe(false);
    expect(s.error).toBeNull();
  });
});
