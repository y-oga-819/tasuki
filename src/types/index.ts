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
  /** Who authored this comment */
  author: "human" | "claude";
}

/** Thread = root comment + flat replies + resolution state */
export interface ReviewThread {
  root: ReviewComment;
  replies: ReviewComment[];
  resolved: boolean;
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
  threads: ReviewThread[];
  doc_comments: DocComment[];
}

/** Overall review verdict */
export type ReviewVerdict = "approve" | "request_changes" | null;

/** Display mode for the main content area */
export type DisplayMode = "diff" | "split" | "viewer";

/** Which content is shown in the right pane of split mode */
export type RightPaneMode = "docs" | "terminal" | "review" | "inspector";

/** Diff view layout (matches Pierre's diffStyle naming) */
export type DiffLayout = "split" | "unified";

/** Repository information */
export interface RepoInfo {
  repo_name: string;
  branch_name: string | null;
  is_worktree: boolean;
}

/** Commit gate status */
export type GateStatus = "none" | "approved" | "rejected" | "invalidated";

/** Commit gate file data returned from backend */
export interface CommitGateData {
  version: number;
  status: "approved" | "rejected";
  timestamp: string;
  repository: string;
  branch: string;
  diff_hash: string;
  resolved_threads: Array<{
    file: string;
    line: number;
    body: string;
  }>;
  resolved_doc_comments: Array<{
    file: string;
    section: string;
    body: string;
  }>;
}

/** Lightweight change status from check_changes command */
export interface ChangeStatus {
  head_sha: string;
  has_changes: boolean;
}

/** Diff source specification */
export type DiffSource =
  | { type: "uncommitted" }
  | { type: "staged" }
  | { type: "working" }
  | { type: "commit"; ref: string }
  | { type: "range"; from: string; to: string };

// ---- LSP / Inspector types ----

/** LSP location result */
export interface LspLocation {
  file_path: string;
  line: number;
  character: number;
  end_line: number;
  end_character: number;
}

/** LSP document symbol */
export interface DocumentSymbolInfo {
  name: string;
  kind: string;
  file_path: string;
  start_line: number;
  start_character: number;
  end_line: number;
  end_character: number;
  children: DocumentSymbolInfo[];
}

/** Call hierarchy entry */
export interface CallHierarchyCall {
  name: string;
  kind: string;
  file_path: string;
  line: number;
  character: number;
  code_snippet: string;
}

/** Result of automatic diff analysis — one per changed method */
export interface MethodInspectionResult {
  name: string;
  file_path: string;
  start_line: number;
  end_line: number;
  changed_lines: number[];
  change_type: "added" | "deleted" | "modified";
  definition_code: string;
  callers: CallHierarchyCall[];
  callees: CallHierarchyCall[];
  hover_info: string | null;
}

/** Progress event from backend analysis */
export interface InspectorProgress {
  done: number;
  total: number;
}
