import { describe, it, expect } from "vitest";
import { gateToThreads, threadsToGate, gateDocToDocComments, docCommentsToGateDoc } from "../store/gate-convert";
import type { GateThread, GateDocThread } from "../types";
import type { ReviewThread, DocComment } from "../types";

// --- Helpers ---

function makeGateThread(overrides: Partial<GateThread> = {}): GateThread {
  return {
    id: "t1",
    file: "src/App.tsx",
    line_start: 10,
    line_end: 10,
    code_snippet: "const x = 1;",
    resolved: false,
    resolved_at: null,
    comments: [
      {
        id: "c1",
        body: "Fix this.",
        author: "human",
        type: "comment",
        created_at: 1700000000,
      },
    ],
    ...overrides,
  };
}

function makeGateDocThread(overrides: Partial<GateDocThread> = {}): GateDocThread {
  return {
    id: "d1",
    file: "docs/architecture.md",
    section: "Overview",
    resolved: false,
    resolved_at: null,
    comments: [
      {
        id: "dc1",
        body: "Needs more detail.",
        author: "human",
        type: "comment",
        created_at: 1700000000,
      },
    ],
    ...overrides,
  };
}

// --- gateToThreads ---

describe("gateToThreads", () => {
  it("converts a single gate thread to ReviewThread map", () => {
    const result = gateToThreads([makeGateThread()]);
    expect(result).toHaveLength(1);

    const thread = result[0];
    expect(thread.root.id).toBe("c1");
    expect(thread.root.file_path).toBe("src/App.tsx");
    expect(thread.root.line_start).toBe(10);
    expect(thread.root.line_end).toBe(10);
    expect(thread.root.code_snippet).toBe("const x = 1;");
    expect(thread.root.body).toBe("Fix this.");
    expect(thread.root.author).toBe("human");
    expect(thread.root.type).toBe("comment");
    expect(thread.root.created_at).toBe(1700000000);
    expect(thread.replies).toHaveLength(0);
    expect(thread.resolved).toBe(false);
    expect(thread.resolved_at).toBeNull();
  });

  it("converts gate thread with replies", () => {
    const gate = makeGateThread({
      comments: [
        { id: "c1", body: "Fix this.", author: "human", type: "comment", created_at: 1700000000 },
        { id: "c2", body: "Fixed.", author: "claude", type: "comment", created_at: 1700001000 },
        { id: "c3", body: "Thanks!", author: "human", type: "comment", created_at: 1700002000 },
      ],
    });
    const result = gateToThreads([gate]);
    expect(result).toHaveLength(1);
    expect(result[0].root.id).toBe("c1");
    expect(result[0].replies).toHaveLength(2);
    expect(result[0].replies[0].body).toBe("Fixed.");
    expect(result[0].replies[0].author).toBe("claude");
    expect(result[0].replies[1].body).toBe("Thanks!");
  });

  it("converts resolved gate thread", () => {
    const gate = makeGateThread({ resolved: true, resolved_at: 1700099000 });
    const result = gateToThreads([gate]);
    expect(result[0].resolved).toBe(true);
    expect(result[0].resolved_at).toBe(1700099000);
  });

  it("converts multiple gate threads", () => {
    const gates = [
      makeGateThread({ id: "t1", file: "src/App.tsx" }),
      makeGateThread({
        id: "t2",
        file: "src/utils.ts",
        line_start: 20,
        comments: [{ id: "c2", body: "Check this.", author: "human", type: "question", created_at: 1700003000 }],
      }),
    ];
    const result = gateToThreads(gates);
    expect(result).toHaveLength(2);
    expect(result[0].root.file_path).toBe("src/App.tsx");
    expect(result[1].root.file_path).toBe("src/utils.ts");
  });

  it("returns empty array for empty input", () => {
    expect(gateToThreads([])).toHaveLength(0);
  });
});

// --- threadsToGate ---

describe("threadsToGate", () => {
  it("converts a single ReviewThread to GateThread", () => {
    const thread: ReviewThread = {
      root: {
        id: "c1",
        file_path: "src/App.tsx",
        line_start: 10,
        line_end: 10,
        code_snippet: "const x = 1;",
        body: "Fix this.",
        type: "comment",
        created_at: 1700000000,
        author: "human",
      },
      replies: [],
      resolved: false,
      resolved_at: null,
    };
    const result = threadsToGate([thread]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("c1");
    expect(result[0].file).toBe("src/App.tsx");
    expect(result[0].line_start).toBe(10);
    expect(result[0].code_snippet).toBe("const x = 1;");
    expect(result[0].comments).toHaveLength(1);
    expect(result[0].comments[0].body).toBe("Fix this.");
  });

  it("converts thread with replies to gate comments array", () => {
    const thread: ReviewThread = {
      root: {
        id: "c1", file_path: "src/App.tsx", line_start: 10, line_end: 10,
        code_snippet: "", body: "Question?", type: "question", created_at: 1700000000, author: "human",
      },
      replies: [
        {
          id: "c2", file_path: "src/App.tsx", line_start: 10, line_end: 10,
          code_snippet: "", body: "Answer.", type: "comment", created_at: 1700001000, author: "claude",
        },
      ],
      resolved: true,
      resolved_at: 1700002000,
    };
    const result = threadsToGate([thread]);
    expect(result[0].comments).toHaveLength(2);
    expect(result[0].comments[0].body).toBe("Question?");
    expect(result[0].comments[1].body).toBe("Answer.");
    expect(result[0].resolved).toBe(true);
    expect(result[0].resolved_at).toBe(1700002000);
  });

  it("returns empty array for empty input", () => {
    expect(threadsToGate([])).toHaveLength(0);
  });
});

// --- gateDocToDocComments ---

describe("gateDocToDocComments", () => {
  it("converts a gate doc thread to DocComment (first comment becomes the doc comment)", () => {
    const result = gateDocToDocComments([makeGateDocThread()]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("dc1");
    expect(result[0].file_path).toBe("docs/architecture.md");
    expect(result[0].section).toBe("Overview");
    expect(result[0].body).toBe("Needs more detail.");
    expect(result[0].resolved).toBe(false);
    expect(result[0].resolved_at).toBeNull();
  });

  it("converts resolved gate doc thread", () => {
    const gate = makeGateDocThread({ resolved: true, resolved_at: 1700099000 });
    const result = gateDocToDocComments([gate]);
    expect(result[0].resolved).toBe(true);
    expect(result[0].resolved_at).toBe(1700099000);
  });

  it("returns empty array for empty input", () => {
    expect(gateDocToDocComments([])).toHaveLength(0);
  });
});

// --- docCommentsToGateDoc ---

describe("docCommentsToGateDoc", () => {
  it("converts a DocComment to GateDocThread", () => {
    const doc: DocComment = {
      id: "dc1",
      file_path: "docs/architecture.md",
      section: "Overview",
      body: "Needs more detail.",
      type: "comment",
      created_at: 1700000000,
      author: "human",
      resolved: false,
      resolved_at: null,
    };
    const result = docCommentsToGateDoc([doc]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("dc1");
    expect(result[0].file).toBe("docs/architecture.md");
    expect(result[0].section).toBe("Overview");
    expect(result[0].comments).toHaveLength(1);
    expect(result[0].comments[0].body).toBe("Needs more detail.");
    expect(result[0].resolved).toBe(false);
  });

  it("returns empty array for empty input", () => {
    expect(docCommentsToGateDoc([])).toHaveLength(0);
  });
});

// --- Round-trip ---

describe("round-trip conversion", () => {
  it("gate → threads → gate preserves data", () => {
    // Note: gate thread id = root comment id (threadsToGate uses root.id as thread id)
    const original: GateThread[] = [
      makeGateThread({
        id: "c1",
        resolved: true,
        resolved_at: 1700099000,
        comments: [
          { id: "c1", body: "Fix.", author: "human", type: "comment", created_at: 1700000000 },
          { id: "c2", body: "Done.", author: "claude", type: "comment", created_at: 1700001000 },
        ],
      }),
    ];
    const threads = gateToThreads(original);
    const back = threadsToGate(threads);
    expect(back).toEqual(original);
  });

  it("docComments → gateDoc → docComments preserves data", () => {
    const original: DocComment[] = [
      {
        id: "dc1", file_path: "docs/arch.md", section: "Intro",
        body: "Explain more.", type: "suggestion", created_at: 1700000000,
        author: "human", resolved: true, resolved_at: 1700099000,
      },
    ];
    const gate = docCommentsToGateDoc(original);
    const back = gateDocToDocComments(gate);
    expect(back).toEqual(original);
  });
});
