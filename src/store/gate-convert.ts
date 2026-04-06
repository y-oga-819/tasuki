import type {
  GateThread,
  GateDocThread,
  GateComment,
  ReviewThread,
  ReviewComment,
  DocComment,
} from "../types";

/** Convert GateThread[] (gate file) → ReviewThread[] (store) */
export function gateToThreads(gateThreads: GateThread[]): ReviewThread[] {
  return gateThreads.filter((gt) => gt.comments.length > 0).map((gt) => {
    const [first, ...rest] = gt.comments;
    const root: ReviewComment = {
      id: first.id,
      file_path: gt.file,
      line_start: gt.line_start,
      line_end: gt.line_end,
      code_snippet: gt.code_snippet,
      body: first.body,
      type: first.type,
      created_at: first.created_at,
      author: first.author,
    };
    const replies: ReviewComment[] = rest.map((c) => ({
      id: c.id,
      file_path: gt.file,
      line_start: gt.line_start,
      line_end: gt.line_end,
      code_snippet: "",
      body: c.body,
      type: c.type,
      created_at: c.created_at,
      author: c.author,
    }));
    return {
      root,
      replies,
      resolved: gt.resolved,
      resolved_at: gt.resolved_at,
    };
  });
}

/** Convert ReviewThread[] (store) → GateThread[] (gate file) */
export function threadsToGate(threads: ReviewThread[]): GateThread[] {
  return threads.map((t) => {
    const toGateComment = (c: ReviewComment): GateComment => ({
      id: c.id,
      body: c.body,
      author: c.author,
      type: c.type,
      created_at: c.created_at,
    });
    return {
      id: t.root.id,
      file: t.root.file_path,
      line_start: t.root.line_start,
      line_end: t.root.line_end,
      code_snippet: t.root.code_snippet,
      resolved: t.resolved,
      resolved_at: t.resolved_at,
      comments: [toGateComment(t.root), ...t.replies.map(toGateComment)],
    };
  });
}

/** Convert GateDocThread[] (gate file) → DocComment[] (store) */
export function gateDocToDocComments(gateDocThreads: GateDocThread[]): DocComment[] {
  return gateDocThreads.filter((gdt) => gdt.comments.length > 0).map((gdt) => {
    const first = gdt.comments[0];
    return {
      id: first.id,
      file_path: gdt.file,
      section: gdt.section,
      body: first.body,
      type: first.type,
      created_at: first.created_at,
      author: first.author,
      resolved: gdt.resolved,
      resolved_at: gdt.resolved_at,
    };
  });
}

/** Convert DocComment[] (store) → GateDocThread[] (gate file) */
export function docCommentsToGateDoc(docComments: DocComment[]): GateDocThread[] {
  return docComments.map((dc) => ({
    id: dc.id,
    file: dc.file_path,
    section: dc.section,
    resolved: dc.resolved,
    resolved_at: dc.resolved_at,
    comments: [
      {
        id: dc.id,
        body: dc.body,
        author: dc.author,
        type: dc.type,
        created_at: dc.created_at,
      },
    ],
  }));
}
