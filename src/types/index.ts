/** A single changed file in a diff */
export interface DiffFile {
  path: string;
  old_path: string | null;
  status: "added" | "deleted" | "modified" | "renamed" | "copied" | "typechange" | "unknown";
  additions: number;
  deletions: number;
  is_binary: boolean;
  is_generated: boolean;
}

/** A diff hunk (section of changes) */
export interface DiffHunk {
  header: string;
  old_start: number;
  old_lines: number;
  new_start: number;
  new_lines: number;
  lines: DiffLine[];
}

/** A single line in a diff */
export interface DiffLine {
  origin: "+" | "-" | " ";
  old_lineno: number | null;
  new_lineno: number | null;
  content: string;
}

/** Complete diff result for a single file */
export interface FileDiff {
  file: DiffFile;
  hunks: DiffHunk[];
  old_content: string | null;
  new_content: string | null;
}

/** Complete diff result */
export interface DiffResult {
  files: FileDiff[];
  stats: DiffStats;
}

/** Diff statistics */
export interface DiffStats {
  files_changed: number;
  additions: number;
  deletions: number;
}

/** Commit info */
export interface CommitInfo {
  id: string;
  short_id: string;
  message: string;
  author: string;
  time: number;
}

/** Review comment on a diff line */
export interface ReviewComment {
  id: string;
  file_path: string;
  line_start: number;
  line_end: number;
  code_snippet: string;
  body: string;
  type: "comment" | "suggestion" | "question" | "approval";
  created_at: number;
  /** null for root comments, ID of parent for replies */
  parent_id: string | null;
  /** Who authored this comment */
  author: "human" | "claude";
  /** Whether this comment has been resolved */
  resolved: boolean;
  /** Timestamp when resolved, null if unresolved */
  resolved_at: number | null;
}

/** Review comment on a document section */
export interface DocComment {
  id: string;
  file_path: string;
  section: string;
  body: string;
  type: "comment" | "suggestion" | "question" | "approval";
  created_at: number;
  /** Who authored this comment */
  author: "human" | "claude";
  /** Whether this comment has been resolved */
  resolved: boolean;
  /** Timestamp when resolved, null if unresolved */
  resolved_at: number | null;
}

/** Persisted review session */
export interface ReviewSession {
  head_commit: string;
  diff_hash: string;
  diff_source: DiffSource;
  created_at: number;
  updated_at: number;
  verdict: ReviewVerdict;
  comments: ReviewComment[];
  doc_comments: DocComment[];
}

/** How to restore a saved review session */
export type ReviewRestoreMode = "full" | "checklist" | "none";

/** Overall review verdict */
export type ReviewVerdict = "approve" | "request_changes" | null;

/** Display mode for the main content area */
export type DisplayMode = "docs" | "diff" | "diff-docs";

/** Diff view layout (matches Pierre's diffStyle naming) */
export type DiffLayout = "split" | "unified";

/** Diff source specification */
export type DiffSource =
  | { type: "uncommitted" }
  | { type: "staged" }
  | { type: "working" }
  | { type: "commit"; ref: string }
  | { type: "range"; from: string; to: string };
