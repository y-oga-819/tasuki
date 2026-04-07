import { describe, it, expect } from "vitest";
import type { GateComment, GateThread, GateDocThread, CommitGateData } from "../types";

describe("Gate file v3 types", () => {
  it("GateComment has required fields", () => {
    const comment: GateComment = {
      id: "uuid-1a",
      body: "テストコメント",
      author: "human",
      type: "comment",
      created_at: 1712102000000,
    };
    expect(comment.author).toBe("human");
    expect(comment.type).toBe("comment");
  });

  it("GateComment supports claude author", () => {
    const comment: GateComment = {
      id: "uuid-1b",
      body: "AI の返信",
      author: "claude",
      type: "comment",
      created_at: 1712102200000,
    };
    expect(comment.author).toBe("claude");
  });

  it("GateThread has thread-level position info and comments array", () => {
    const thread: GateThread = {
      id: "uuid-1",
      file: "src/App.tsx",
      line_start: 4,
      line_end: 5,
      code_snippet: "const x = 1;\nconst y = 2;",
      resolved: false,
      resolved_at: null,
      comments: [
        {
          id: "uuid-1a",
          body: "ここを修正してください",
          author: "human",
          type: "comment",
          created_at: 1712102000000,
        },
      ],
    };
    expect(thread.comments).toHaveLength(1);
    expect(thread.file).toBe("src/App.tsx");
    expect(thread.resolved).toBe(false);
  });

  it("GateThread supports resolved state", () => {
    const thread: GateThread = {
      id: "uuid-2",
      file: "src/utils.ts",
      line_start: 10,
      line_end: 10,
      code_snippet: "",
      resolved: true,
      resolved_at: 1712102400000,
      comments: [
        {
          id: "uuid-2a",
          body: "質問です",
          author: "human",
          type: "question",
          created_at: 1712102000000,
        },
        {
          id: "uuid-2b",
          body: "回答です",
          author: "claude",
          type: "comment",
          created_at: 1712102200000,
        },
      ],
    };
    expect(thread.resolved).toBe(true);
    expect(thread.resolved_at).toBe(1712102400000);
    expect(thread.comments).toHaveLength(2);
  });

  it("GateDocThread has section instead of line info", () => {
    const docThread: GateDocThread = {
      id: "uuid-3",
      file: "architecture.md",
      section: "Rate Limiter",
      resolved: false,
      resolved_at: null,
      comments: [
        {
          id: "uuid-3a",
          body: "根拠を記載してほしい",
          author: "human",
          type: "suggestion",
          created_at: 1712102000000,
        },
      ],
    };
    expect(docThread.section).toBe("Rate Limiter");
    expect(docThread.comments).toHaveLength(1);
  });

  it("CommitGateData v3 has threads and doc_threads", () => {
    const gate: CommitGateData = {
      version: 3,
      status: "rejected",
      timestamp: "2026-04-03T01:00:00Z",
      repository: "tasuki",
      branch: "feature/test",
      threads: [
        {
          id: "uuid-1",
          file: "src/App.tsx",
          line_start: 4,
          line_end: 5,
          code_snippet: "const x = 1;",
          resolved: false,
          resolved_at: null,
          comments: [
            {
              id: "uuid-1a",
              body: "コメント",
              author: "human",
              type: "comment",
              created_at: 1712102000000,
            },
          ],
        },
      ],
      doc_threads: [],
    };
    expect(gate.version).toBe(3);
    expect(gate.status).toBe("rejected");
    expect(gate.threads).toHaveLength(1);
    expect(gate.doc_threads).toHaveLength(0);
  });

  it("CommitGateData supports approved status", () => {
    const gate: CommitGateData = {
      version: 3,
      status: "approved",
      timestamp: "2026-04-03T02:00:00Z",
      repository: "tasuki",
      branch: "feature/test",
      threads: [],
      doc_threads: [],
    };
    expect(gate.status).toBe("approved");
  });
});
