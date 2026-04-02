import type { DiffStats, FileDiff, DiffResult } from "../types";

// ─── 1. Modified: React component (multi-hunk) ─────────────────────────

const modifiedFile: FileDiff = {
  file: {
    path: "src/components/DiffViewer.tsx",
    old_path: null,
    status: "modified",
    additions: 18,
    deletions: 5,
    is_binary: false,
    is_generated: false,
  },
  hunks: [
    {
      header: "@@ -1,7 +1,9 @@",
      old_start: 1,
      old_lines: 7,
      new_start: 1,
      new_lines: 9,
      lines: [
        { origin: " ", old_lineno: 1, new_lineno: 1, content: "import React, { useState, useCallback } from 'react';" },
        { origin: " ", old_lineno: 2, new_lineno: 2, content: "import { DiffLayout } from '../types';" },
        { origin: " ", old_lineno: 3, new_lineno: 3, content: "import { useStore } from '../store';" },
        { origin: "+", old_lineno: null, new_lineno: 4, content: "import { formatLineRange } from '../utils/format-helpers';" },
        { origin: "+", old_lineno: null, new_lineno: 5, content: "import { copyToClipboard } from '../utils/clipboard';" },
        { origin: " ", old_lineno: 4, new_lineno: 6, content: "" },
        { origin: " ", old_lineno: 5, new_lineno: 7, content: "export function DiffViewer() {" },
        { origin: " ", old_lineno: 6, new_lineno: 8, content: "  const diff = useStore(s => s.diffResult);" },
        { origin: " ", old_lineno: 7, new_lineno: 9, content: "  const files = diff?.files ?? [];" },
      ],
    },
    {
      header: "@@ -10,8 +12,21 @@ export function DiffViewer() {",
      old_start: 10,
      old_lines: 8,
      new_start: 12,
      new_lines: 21,
      lines: [
        { origin: " ", old_lineno: 10, new_lineno: 12, content: "  const [layout, setLayout] = useState<DiffLayout>('split');" },
        { origin: " ", old_lineno: 11, new_lineno: 13, content: "  const comments = useStore(s => s.comments);" },
        { origin: "-", old_lineno: 12, new_lineno: null, content: "  const handleClick = () => {" },
        { origin: "-", old_lineno: 13, new_lineno: null, content: "    console.log('clicked');" },
        { origin: "+", old_lineno: null, new_lineno: 14, content: "  const handleLineSelect = useCallback((file: string, line: number) => {" },
        { origin: "+", old_lineno: null, new_lineno: 15, content: "    setSelectedLine({ file, line });" },
        { origin: "+", old_lineno: null, new_lineno: 16, content: "    setCommentFormOpen(true);" },
        { origin: " ", old_lineno: 14, new_lineno: 17, content: "  };" },
        { origin: " ", old_lineno: 15, new_lineno: 18, content: "" },
        { origin: "-", old_lineno: 16, new_lineno: null, content: "  // TODO: implement comment submit" },
        { origin: "+", old_lineno: null, new_lineno: 19, content: "  const handleCommentSubmit = useCallback((body: string) => {" },
        { origin: "+", old_lineno: null, new_lineno: 20, content: "    const range = formatLineRange(selectedLine.line, selectedLine.line);" },
        { origin: "+", old_lineno: null, new_lineno: 21, content: "    addComment({ file: selectedLine.file, line: selectedLine.line, body });" },
        { origin: "+", old_lineno: null, new_lineno: 22, content: "    setCommentFormOpen(false);" },
        { origin: "+", old_lineno: null, new_lineno: 23, content: "  }, [selectedLine]);" },
        { origin: "+", old_lineno: null, new_lineno: 24, content: "" },
        { origin: "+", old_lineno: null, new_lineno: 25, content: "  const handleCopyComment = useCallback(async (comment: ReviewComment) => {" },
        { origin: "+", old_lineno: null, new_lineno: 26, content: "    const text = `${comment.file}:L${comment.line} ${comment.body}`;" },
        { origin: "+", old_lineno: null, new_lineno: 27, content: "    await copyToClipboard(text);" },
        { origin: "+", old_lineno: null, new_lineno: 28, content: "  }, []);" },
        { origin: "+", old_lineno: null, new_lineno: 29, content: "" },
        { origin: " ", old_lineno: 17, new_lineno: 30, content: "  return (" },
        { origin: " ", old_lineno: 18, new_lineno: 31, content: "    <div className=\"diff-viewer\">" },
      ],
    },
  ],
  old_content: `\
import React, { useState, useCallback } from 'react';
import { DiffLayout } from '../types';
import { useStore } from '../store';

export function DiffViewer() {
  const diff = useStore(s => s.diffResult);
  const files = diff?.files ?? [];

  // State
  const [layout, setLayout] = useState<DiffLayout>('split');
  const comments = useStore(s => s.comments);
  const handleClick = () => {
    console.log('clicked');
  };

  // TODO: implement comment submit
  return (
    <div className="diff-viewer">
      {/* ... */}
    </div>
  );
}`,
  new_content: `\
import React, { useState, useCallback } from 'react';
import { DiffLayout } from '../types';
import { useStore } from '../store';
import { formatLineRange } from '../utils/format-helpers';
import { copyToClipboard } from '../utils/clipboard';

export function DiffViewer() {
  const diff = useStore(s => s.diffResult);
  const files = diff?.files ?? [];

  // State
  const [layout, setLayout] = useState<DiffLayout>('split');
  const comments = useStore(s => s.comments);
  const handleLineSelect = useCallback((file: string, line: number) => {
    setSelectedLine({ file, line });
    setCommentFormOpen(true);
  };

  const handleCommentSubmit = useCallback((body: string) => {
    const range = formatLineRange(selectedLine.line, selectedLine.line);
    addComment({ file: selectedLine.file, line: selectedLine.line, body });
    setCommentFormOpen(false);
  }, [selectedLine]);

  const handleCopyComment = useCallback(async (comment: ReviewComment) => {
    const text = \`\${comment.file}:L\${comment.line} \${comment.body}\`;
    await copyToClipboard(text);
  }, []);

  return (
    <div className="diff-viewer">
      {/* ... */}
    </div>
  );
}`,
};

// ─── 2. Added: New utility file ─────────────────────────────────────────

const addedFile: FileDiff = {
  file: {
    path: "src/utils/format-helpers.ts",
    old_path: null,
    status: "added",
    additions: 24,
    deletions: 0,
    is_binary: false,
    is_generated: false,
  },
  hunks: [
    {
      header: "@@ -0,0 +1,24 @@",
      old_start: 0,
      old_lines: 0,
      new_start: 1,
      new_lines: 24,
      lines: [
        { origin: "+", old_lineno: null, new_lineno: 1, content: "/**" },
        { origin: "+", old_lineno: null, new_lineno: 2, content: " * Format a line range for display." },
        { origin: "+", old_lineno: null, new_lineno: 3, content: " */" },
        { origin: "+", old_lineno: null, new_lineno: 4, content: "export function formatLineRange(start: number, end: number): string {" },
        { origin: "+", old_lineno: null, new_lineno: 5, content: "  if (start === end) return `L${start}`;" },
        { origin: "+", old_lineno: null, new_lineno: 6, content: "  return `L${start}-L${end}`;" },
        { origin: "+", old_lineno: null, new_lineno: 7, content: "}" },
        { origin: "+", old_lineno: null, new_lineno: 8, content: "" },
        { origin: "+", old_lineno: null, new_lineno: 9, content: "/**" },
        { origin: "+", old_lineno: null, new_lineno: 10, content: " * Truncate text to a maximum length with ellipsis." },
        { origin: "+", old_lineno: null, new_lineno: 11, content: " */" },
        { origin: "+", old_lineno: null, new_lineno: 12, content: "export function truncate(text: string, maxLen: number): string {" },
        { origin: "+", old_lineno: null, new_lineno: 13, content: "  if (text.length <= maxLen) return text;" },
        { origin: "+", old_lineno: null, new_lineno: 14, content: "  return text.slice(0, maxLen - 3) + '...';" },
        { origin: "+", old_lineno: null, new_lineno: 15, content: "}" },
        { origin: "+", old_lineno: null, new_lineno: 16, content: "" },
        { origin: "+", old_lineno: null, new_lineno: 17, content: "/**" },
        { origin: "+", old_lineno: null, new_lineno: 18, content: " * Format a timestamp as relative time (e.g. \"2 hours ago\")." },
        { origin: "+", old_lineno: null, new_lineno: 19, content: " */" },
        { origin: "+", old_lineno: null, new_lineno: 20, content: "export function formatRelativeTime(timestamp: number): string {" },
        { origin: "+", old_lineno: null, new_lineno: 21, content: "  const diff = Date.now() - timestamp;" },
        { origin: "+", old_lineno: null, new_lineno: 22, content: "  const minutes = Math.floor(diff / 60_000);" },
        { origin: "+", old_lineno: null, new_lineno: 23, content: "  if (minutes < 60) return `${minutes}m ago`;" },
        { origin: "+", old_lineno: null, new_lineno: 24, content: "  return `${Math.floor(minutes / 60)}h ago`;" },
      ],
    },
  ],
  old_content: null,
  new_content: `\
/**
 * Format a line range for display.
 */
export function formatLineRange(start: number, end: number): string {
  if (start === end) return \`L\${start}\`;
  return \`L\${start}-L\${end}\`;
}

/**
 * Truncate text to a maximum length with ellipsis.
 */
export function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + '...';
}

/**
 * Format a timestamp as relative time (e.g. "2 hours ago").
 */
export function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return \`\${minutes}m ago\`;
  return \`\${Math.floor(minutes / 60)}h ago\`;
}`,
};

// ─── 3. Deleted: Legacy helpers ──────────────────────────────────────────

const deletedFile: FileDiff = {
  file: {
    path: "src/utils/legacy-helpers.ts",
    old_path: null,
    status: "deleted",
    additions: 0,
    deletions: 8,
    is_binary: false,
    is_generated: false,
  },
  hunks: [
    {
      header: "@@ -1,8 +0,0 @@",
      old_start: 1,
      old_lines: 8,
      new_start: 0,
      new_lines: 0,
      lines: [
        { origin: "-", old_lineno: 1, new_lineno: null, content: "// Legacy helper functions" },
        { origin: "-", old_lineno: 2, new_lineno: null, content: "export function oldFormat(s: string): string {" },
        { origin: "-", old_lineno: 3, new_lineno: null, content: "  return s.trim().toLowerCase();" },
        { origin: "-", old_lineno: 4, new_lineno: null, content: "}" },
        { origin: "-", old_lineno: 5, new_lineno: null, content: "" },
        { origin: "-", old_lineno: 6, new_lineno: null, content: "export function oldParse(input: string): number {" },
        { origin: "-", old_lineno: 7, new_lineno: null, content: "  return parseInt(input, 10);" },
        { origin: "-", old_lineno: 8, new_lineno: null, content: "}" },
      ],
    },
  ],
  old_content: `\
// Legacy helper functions
export function oldFormat(s: string): string {
  return s.trim().toLowerCase();
}

export function oldParse(input: string): number {
  return parseInt(input, 10);
}`,
  new_content: null,
};

// ─── 4. Renamed: clipboard utility ──────────────────────────────────────

const renamedFile: FileDiff = {
  file: {
    path: "src/utils/clipboard.ts",
    old_path: "src/utils/copy-utils.ts",
    status: "renamed",
    additions: 3,
    deletions: 1,
    is_binary: false,
    is_generated: false,
  },
  hunks: [
    {
      header: "@@ -1,6 +1,8 @@",
      old_start: 1,
      old_lines: 6,
      new_start: 1,
      new_lines: 8,
      lines: [
        { origin: "-", old_lineno: 1, new_lineno: null, content: "export async function copyText(text: string): Promise<void> {" },
        { origin: "+", old_lineno: null, new_lineno: 1, content: "/**" },
        { origin: "+", old_lineno: null, new_lineno: 2, content: " * Copy text to clipboard with fallback." },
        { origin: "+", old_lineno: null, new_lineno: 3, content: " */" },
        { origin: "+", old_lineno: null, new_lineno: 4, content: "export async function copyToClipboard(text: string): Promise<void> {" },
        { origin: " ", old_lineno: 2, new_lineno: 5, content: "  try {" },
        { origin: " ", old_lineno: 3, new_lineno: 6, content: "    await navigator.clipboard.writeText(text);" },
        { origin: " ", old_lineno: 4, new_lineno: 7, content: "  } catch {" },
        { origin: " ", old_lineno: 5, new_lineno: 8, content: "    console.warn('Clipboard write failed');" },
      ],
    },
  ],
  old_content: `\
export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    console.warn('Clipboard write failed');
  }
}`,
  new_content: `\
/**
 * Copy text to clipboard with fallback.
 */
export async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    console.warn('Clipboard write failed');
  }
}`,
};

// ─── 5. Modified: CSS design tokens ─────────────────────────────────────

const cssTokensFile: FileDiff = {
  file: {
    path: "src/styles/tokens.css",
    old_path: null,
    status: "modified",
    additions: 12,
    deletions: 4,
    is_binary: false,
    is_generated: false,
  },
  hunks: [
    {
      header: "@@ -1,14 +1,22 @@",
      old_start: 1,
      old_lines: 14,
      new_start: 1,
      new_lines: 22,
      lines: [
        { origin: " ", old_lineno: 1, new_lineno: 1, content: ":root {" },
        { origin: " ", old_lineno: 2, new_lineno: 2, content: "  /* Colors */" },
        { origin: "-", old_lineno: 3, new_lineno: null, content: "  --color-bg: #ffffff;" },
        { origin: "-", old_lineno: 4, new_lineno: null, content: "  --color-fg: #1a1a1a;" },
        { origin: "+", old_lineno: null, new_lineno: 3, content: "  --color-bg: #fafafa;" },
        { origin: "+", old_lineno: null, new_lineno: 4, content: "  --color-fg: #171717;" },
        { origin: "+", old_lineno: null, new_lineno: 5, content: "  --color-bg-elevated: #ffffff;" },
        { origin: "+", old_lineno: null, new_lineno: 6, content: "  --color-border: #e5e5e5;" },
        { origin: " ", old_lineno: 5, new_lineno: 7, content: "  --color-accent: #2563eb;" },
        { origin: " ", old_lineno: 6, new_lineno: 8, content: "  --color-danger: #dc2626;" },
        { origin: " ", old_lineno: 7, new_lineno: 9, content: "  --color-success: #16a34a;" },
        { origin: "+", old_lineno: null, new_lineno: 10, content: "  --color-warning: #ca8a04;" },
        { origin: " ", old_lineno: 8, new_lineno: 11, content: "" },
        { origin: " ", old_lineno: 9, new_lineno: 12, content: "  /* Spacing */" },
        { origin: " ", old_lineno: 10, new_lineno: 13, content: "  --space-xs: 4px;" },
        { origin: " ", old_lineno: 11, new_lineno: 14, content: "  --space-sm: 8px;" },
        { origin: " ", old_lineno: 12, new_lineno: 15, content: "  --space-md: 16px;" },
        { origin: " ", old_lineno: 13, new_lineno: 16, content: "  --space-lg: 24px;" },
        { origin: "-", old_lineno: 14, new_lineno: null, content: "}" },
        { origin: "+", old_lineno: null, new_lineno: 17, content: "  --space-xl: 32px;" },
        { origin: "+", old_lineno: null, new_lineno: 18, content: "" },
        { origin: "+", old_lineno: null, new_lineno: 19, content: "  /* Typography */" },
        { origin: "+", old_lineno: null, new_lineno: 20, content: "  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;" },
        { origin: "+", old_lineno: null, new_lineno: 21, content: "  --font-sans: 'Inter', -apple-system, sans-serif;" },
        { origin: "+", old_lineno: null, new_lineno: 22, content: "}" },
      ],
    },
  ],
  old_content: `:root {
  /* Colors */
  --color-bg: #ffffff;
  --color-fg: #1a1a1a;
  --color-accent: #2563eb;
  --color-danger: #dc2626;
  --color-success: #16a34a;

  /* Spacing */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
}`,
  new_content: `:root {
  /* Colors */
  --color-bg: #fafafa;
  --color-fg: #171717;
  --color-bg-elevated: #ffffff;
  --color-border: #e5e5e5;
  --color-accent: #2563eb;
  --color-danger: #dc2626;
  --color-success: #16a34a;
  --color-warning: #ca8a04;

  /* Spacing */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;

  /* Typography */
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
  --font-sans: 'Inter', -apple-system, sans-serif;
}`,
};

// ─── 6. Modified: Rust backend command ───────────────────────────────────

const rustCommandFile: FileDiff = {
  file: {
    path: "src-tauri/src/commands/diff.rs",
    old_path: null,
    status: "modified",
    additions: 15,
    deletions: 3,
    is_binary: false,
    is_generated: false,
  },
  hunks: [
    {
      header: "@@ -22,9 +22,21 @@ pub fn get_diff(state: State<'_, AppState>) -> Result<DiffResult, AppError> {",
      old_start: 22,
      old_lines: 9,
      new_start: 22,
      new_lines: 21,
      lines: [
        { origin: " ", old_lineno: 22, new_lineno: 22, content: "    let repo = state.repo.lock().map_err(|_| AppError::LockError)?;" },
        { origin: " ", old_lineno: 23, new_lineno: 23, content: "    let diff = repo.diff_index_to_workdir(None, None)?;" },
        { origin: " ", old_lineno: 24, new_lineno: 24, content: "" },
        { origin: "-", old_lineno: 25, new_lineno: null, content: "    let files = parse_diff(&diff)?;" },
        { origin: "-", old_lineno: 26, new_lineno: null, content: "    let stats = compute_stats(&files);" },
        { origin: "+", old_lineno: null, new_lineno: 25, content: "    let mut files = parse_diff(&diff)?;" },
        { origin: "+", old_lineno: null, new_lineno: 26, content: "" },
        { origin: "+", old_lineno: null, new_lineno: 27, content: "    // Sort files: modified first, then added, deleted, renamed" },
        { origin: "+", old_lineno: null, new_lineno: 28, content: "    files.sort_by(|a, b| {" },
        { origin: "+", old_lineno: null, new_lineno: 29, content: "        let priority = |f: &FileDiff| match f.file.status {" },
        { origin: "+", old_lineno: null, new_lineno: 30, content: "            FileStatus::Modified => 0," },
        { origin: "+", old_lineno: null, new_lineno: 31, content: "            FileStatus::Added => 1," },
        { origin: "+", old_lineno: null, new_lineno: 32, content: "            FileStatus::Deleted => 2," },
        { origin: "+", old_lineno: null, new_lineno: 33, content: "            _ => 3," },
        { origin: "+", old_lineno: null, new_lineno: 34, content: "        };" },
        { origin: "+", old_lineno: null, new_lineno: 35, content: "        priority(a).cmp(&priority(b))" },
        { origin: "+", old_lineno: null, new_lineno: 36, content: "    });" },
        { origin: "+", old_lineno: null, new_lineno: 37, content: "" },
        { origin: "+", old_lineno: null, new_lineno: 38, content: "    let stats = compute_stats(&files);" },
        { origin: " ", old_lineno: 27, new_lineno: 39, content: "" },
        { origin: "-", old_lineno: 28, new_lineno: null, content: "    Ok(DiffResult { files, stats })" },
        { origin: "+", old_lineno: null, new_lineno: 40, content: "    log::info!(\"Computed diff: {} files changed\", stats.files_changed);" },
        { origin: "+", old_lineno: null, new_lineno: 41, content: "    Ok(DiffResult { files, stats })" },
        { origin: " ", old_lineno: 29, new_lineno: 42, content: "}" },
      ],
    },
  ],
  old_content: `use tauri::State;
use crate::error::AppError;
use crate::state::AppState;
use crate::git::diff::{parse_diff, compute_stats, DiffResult, FileDiff, FileStatus};

/// Get the diff between HEAD and working directory.
#[tauri::command]
pub fn get_diff(state: State<'_, AppState>) -> Result<DiffResult, AppError> {
    let repo = state.repo.lock().map_err(|_| AppError::LockError)?;
    let diff = repo.diff_index_to_workdir(None, None)?;

    let files = parse_diff(&diff)?;
    let stats = compute_stats(&files);

    Ok(DiffResult { files, stats })
}`,
  new_content: `use tauri::State;
use crate::error::AppError;
use crate::state::AppState;
use crate::git::diff::{parse_diff, compute_stats, DiffResult, FileDiff, FileStatus};

/// Get the diff between HEAD and working directory.
#[tauri::command]
pub fn get_diff(state: State<'_, AppState>) -> Result<DiffResult, AppError> {
    let repo = state.repo.lock().map_err(|_| AppError::LockError)?;
    let diff = repo.diff_index_to_workdir(None, None)?;

    let mut files = parse_diff(&diff)?;

    // Sort files: modified first, then added, deleted, renamed
    files.sort_by(|a, b| {
        let priority = |f: &FileDiff| match f.file.status {
            FileStatus::Modified => 0,
            FileStatus::Added => 1,
            FileStatus::Deleted => 2,
            _ => 3,
        };
        priority(a).cmp(&priority(b))
    });

    let stats = compute_stats(&files);

    log::info!("Computed diff: {} files changed", stats.files_changed);
    Ok(DiffResult { files, stats })
}`,
};

// ─── 7. Modified: package.json ───────────────────────────────────────────

const packageJsonFile: FileDiff = {
  file: {
    path: "package.json",
    old_path: null,
    status: "modified",
    additions: 4,
    deletions: 1,
    is_binary: false,
    is_generated: false,
  },
  hunks: [
    {
      header: "@@ -18,7 +18,10 @@",
      old_start: 18,
      old_lines: 7,
      new_start: 18,
      new_lines: 10,
      lines: [
        { origin: " ", old_lineno: 18, new_lineno: 18, content: "    \"react\": \"^19.2.0\"," },
        { origin: " ", old_lineno: 19, new_lineno: 19, content: "    \"react-dom\": \"^19.2.0\"," },
        { origin: " ", old_lineno: 20, new_lineno: 20, content: "    \"zustand\": \"^5.0.5\"," },
        { origin: "-", old_lineno: 21, new_lineno: null, content: "    \"react-markdown\": \"^10.1.0\"" },
        { origin: "+", old_lineno: null, new_lineno: 21, content: "    \"react-markdown\": \"^10.1.0\"," },
        { origin: "+", old_lineno: null, new_lineno: 22, content: "    \"remark-gfm\": \"^4.0.1\"," },
        { origin: "+", old_lineno: null, new_lineno: 23, content: "    \"beautiful-mermaid\": \"^1.1.3\"," },
        { origin: "+", old_lineno: null, new_lineno: 24, content: "    \"shiki\": \"^4.0.0\"" },
        { origin: " ", old_lineno: 22, new_lineno: 25, content: "  }," },
        { origin: " ", old_lineno: 23, new_lineno: 26, content: "  \"devDependencies\": {" },
        { origin: " ", old_lineno: 24, new_lineno: 27, content: "    \"@vitejs/plugin-react\": \"^4.4.1\"," },
      ],
    },
  ],
  old_content: null,
  new_content: null,
};

// ─── 8. Modified: Hook with long lines (Scroll/Wrap demo) ───────────────

const hookFile: FileDiff = {
  file: {
    path: "src/hooks/useFileWatcher.ts",
    old_path: null,
    status: "modified",
    additions: 14,
    deletions: 6,
    is_binary: false,
    is_generated: false,
  },
  hunks: [
    {
      header: "@@ -5,10 +5,12 @@ import { useStore } from '../store';",
      old_start: 5,
      old_lines: 10,
      new_start: 5,
      new_lines: 12,
      lines: [
        { origin: " ", old_lineno: 5, new_lineno: 5, content: "export function useFileWatcher() {" },
        { origin: " ", old_lineno: 6, new_lineno: 6, content: "  const diffSource = useStore(s => s.diffSource);" },
        { origin: "-", old_lineno: 7, new_lineno: null, content: "  const refresh = useStore(s => s.fetchDiff);" },
        { origin: "+", old_lineno: null, new_lineno: 7, content: "  const refreshDiff = useStore(s => s.fetchDiff);" },
        { origin: "+", old_lineno: null, new_lineno: 8, content: "  const isAutoRefreshEnabled = useStore(s => s.preferences.autoRefresh ?? true);  // default to true for better DX when reviewing local changes" },
        { origin: " ", old_lineno: 8, new_lineno: 9, content: "" },
        { origin: " ", old_lineno: 9, new_lineno: 10, content: "  useEffect(() => {" },
        { origin: "-", old_lineno: 10, new_lineno: null, content: "    const unsubscribe = tauriEvents.onFileChange(() => refresh());" },
        { origin: "+", old_lineno: null, new_lineno: 11, content: "    if (!isAutoRefreshEnabled) return;  // skip watcher setup when auto-refresh is disabled to avoid unnecessary file system operations and reduce CPU usage in large repositories" },
        { origin: "+", old_lineno: null, new_lineno: 12, content: "" },
        { origin: "+", old_lineno: null, new_lineno: 13, content: "    const unsubscribe = tauriEvents.onFileChange(() => { console.debug('[watcher] File change detected, refreshing diff...'); refreshDiff(); });" },
        { origin: " ", old_lineno: 11, new_lineno: 14, content: "    return () => { unsubscribe(); };" },
        { origin: "-", old_lineno: 12, new_lineno: null, content: "  }, [refresh]);" },
        { origin: "+", old_lineno: null, new_lineno: 15, content: "  }, [refreshDiff, isAutoRefreshEnabled]);" },
      ],
    },
    {
      header: "@@ -20,8 +22,14 @@ export function useFileWatcher() {",
      old_start: 20,
      old_lines: 8,
      new_start: 22,
      new_lines: 14,
      lines: [
        { origin: " ", old_lineno: 20, new_lineno: 22, content: "  // Poll for changes when file watcher is unavailable" },
        { origin: " ", old_lineno: 21, new_lineno: 23, content: "  useEffect(() => {" },
        { origin: "-", old_lineno: 22, new_lineno: null, content: "    const interval = setInterval(() => checkChanges(), 5000);" },
        { origin: "-", old_lineno: 23, new_lineno: null, content: "    return () => clearInterval(interval);" },
        { origin: "+", old_lineno: null, new_lineno: 24, content: "    const POLL_INTERVAL_MS = isAutoRefreshEnabled ? 3000 : 10000;  // poll more frequently when auto-refresh is enabled for responsive UX, otherwise use a relaxed interval to conserve resources" },
        { origin: "+", old_lineno: null, new_lineno: 25, content: "" },
        { origin: "+", old_lineno: null, new_lineno: 26, content: "    const interval = setInterval(async () => {" },
        { origin: "+", old_lineno: null, new_lineno: 27, content: "      const status = await checkChanges();" },
        { origin: "+", old_lineno: null, new_lineno: 28, content: "      if (status.has_changes) {" },
        { origin: "+", old_lineno: null, new_lineno: 29, content: "        console.debug(`[watcher] Changes detected via polling (sha: ${status.head_sha.slice(0, 7)}), triggering refresh...`);" },
        { origin: "+", old_lineno: null, new_lineno: 30, content: "        refreshDiff();" },
        { origin: "+", old_lineno: null, new_lineno: 31, content: "      }" },
        { origin: "+", old_lineno: null, new_lineno: 32, content: "    }, POLL_INTERVAL_MS);" },
        { origin: "+", old_lineno: null, new_lineno: 33, content: "    return () => clearInterval(interval);" },
        { origin: " ", old_lineno: 24, new_lineno: 34, content: "  }, []);" },
        { origin: " ", old_lineno: 25, new_lineno: 35, content: "}" },
      ],
    },
  ],
  old_content: null,
  new_content: null,
};

// ─── 9. Modified: Markdown documentation ─────────────────────────────────

const docsFile: FileDiff = {
  file: {
    path: "docs/USAGE_EXAMPLES.md",
    old_path: null,
    status: "modified",
    additions: 16,
    deletions: 2,
    is_binary: false,
    is_generated: false,
  },
  hunks: [
    {
      header: "@@ -8,8 +8,22 @@",
      old_start: 8,
      old_lines: 8,
      new_start: 8,
      new_lines: 22,
      lines: [
        { origin: " ", old_lineno: 8, new_lineno: 8, content: "## Basic Usage" },
        { origin: " ", old_lineno: 9, new_lineno: 9, content: "" },
        { origin: "-", old_lineno: 10, new_lineno: null, content: "Run `tasuki` in your git repository to start reviewing." },
        { origin: "+", old_lineno: null, new_lineno: 10, content: "Run `tasuki` in your git repository to start reviewing:" },
        { origin: "+", old_lineno: null, new_lineno: 11, content: "" },
        { origin: "+", old_lineno: null, new_lineno: 12, content: "```bash" },
        { origin: "+", old_lineno: null, new_lineno: 13, content: "cd your-project" },
        { origin: "+", old_lineno: null, new_lineno: 14, content: "tasuki               # review uncommitted changes" },
        { origin: "+", old_lineno: null, new_lineno: 15, content: "tasuki --staged       # review staged changes only" },
        { origin: "+", old_lineno: null, new_lineno: 16, content: "tasuki --ref main     # review diff from main branch" },
        { origin: "+", old_lineno: null, new_lineno: 17, content: "```" },
        { origin: " ", old_lineno: 11, new_lineno: 18, content: "" },
        { origin: "-", old_lineno: 12, new_lineno: null, content: "## Keyboard Shortcuts" },
        { origin: "+", old_lineno: null, new_lineno: 19, content: "## Keyboard Shortcuts" },
        { origin: "+", old_lineno: null, new_lineno: 20, content: "" },
        { origin: "+", old_lineno: null, new_lineno: 21, content: "| Key | Action |" },
        { origin: "+", old_lineno: null, new_lineno: 22, content: "|-----|--------|" },
        { origin: "+", old_lineno: null, new_lineno: 23, content: "| `Cmd/Ctrl+F` | Search in diff |" },
        { origin: "+", old_lineno: null, new_lineno: 24, content: "| `Cmd/Ctrl+Enter` | Submit comment |" },
        { origin: "+", old_lineno: null, new_lineno: 25, content: "| `Escape` | Close form / modal |" },
        { origin: " ", old_lineno: 13, new_lineno: 26, content: "" },
        { origin: " ", old_lineno: 14, new_lineno: 27, content: "## Advanced" },
        { origin: " ", old_lineno: 15, new_lineno: 28, content: "" },
      ],
    },
  ],
  old_content: null,
  new_content: null,
};

// ─── 10. Generated: lockfile (auto-collapsed) ────────────────────────────

const lockFile: FileDiff = {
  file: {
    path: "package-lock.json",
    old_path: null,
    status: "modified",
    additions: 8,
    deletions: 1,
    is_binary: false,
    is_generated: true,
  },
  hunks: [
    {
      header: "@@ -142,7 +142,14 @@",
      old_start: 142,
      old_lines: 7,
      new_start: 142,
      new_lines: 14,
      lines: [
        { origin: " ", old_lineno: 142, new_lineno: 142, content: "    \"react-markdown\": {" },
        { origin: " ", old_lineno: 143, new_lineno: 143, content: "      \"version\": \"10.1.0\"," },
        { origin: " ", old_lineno: 144, new_lineno: 144, content: "      \"resolved\": \"https://registry.npmjs.org/react-markdown/-/react-markdown-10.1.0.tgz\"" },
        { origin: "-", old_lineno: 145, new_lineno: null, content: "    }" },
        { origin: "+", old_lineno: null, new_lineno: 145, content: "    }," },
        { origin: "+", old_lineno: null, new_lineno: 146, content: "    \"beautiful-mermaid\": {" },
        { origin: "+", old_lineno: null, new_lineno: 147, content: "      \"version\": \"1.1.3\"," },
        { origin: "+", old_lineno: null, new_lineno: 148, content: "      \"resolved\": \"https://registry.npmjs.org/beautiful-mermaid/-/beautiful-mermaid-1.1.3.tgz\"" },
        { origin: "+", old_lineno: null, new_lineno: 149, content: "    }," },
        { origin: "+", old_lineno: null, new_lineno: 150, content: "    \"shiki\": {" },
        { origin: "+", old_lineno: null, new_lineno: 151, content: "      \"version\": \"4.0.0\"," },
        { origin: "+", old_lineno: null, new_lineno: 152, content: "      \"resolved\": \"https://registry.npmjs.org/shiki/-/shiki-4.0.0.tgz\"" },
        { origin: " ", old_lineno: 146, new_lineno: 153, content: "    }" },
        { origin: " ", old_lineno: 147, new_lineno: 154, content: "  }" },
        { origin: " ", old_lineno: 148, new_lineno: 155, content: "}" },
      ],
    },
  ],
  old_content: null,
  new_content: null,
};

// ─── Staged variant: DiffViewer.tsx (imports only) ──────────────────────

const modifiedFileStaged: FileDiff = {
  file: {
    path: "src/components/DiffViewer.tsx",
    old_path: null,
    status: "modified",
    additions: 2,
    deletions: 0,
    is_binary: false,
    is_generated: false,
  },
  hunks: [
    {
      header: "@@ -1,7 +1,9 @@",
      old_start: 1,
      old_lines: 7,
      new_start: 1,
      new_lines: 9,
      lines: [
        { origin: " ", old_lineno: 1, new_lineno: 1, content: "import React, { useState, useCallback } from 'react';" },
        { origin: " ", old_lineno: 2, new_lineno: 2, content: "import { DiffLayout } from '../types';" },
        { origin: " ", old_lineno: 3, new_lineno: 3, content: "import { useStore } from '../store';" },
        { origin: "+", old_lineno: null, new_lineno: 4, content: "import { formatLineRange } from '../utils/format-helpers';" },
        { origin: "+", old_lineno: null, new_lineno: 5, content: "import { copyToClipboard } from '../utils/clipboard';" },
        { origin: " ", old_lineno: 4, new_lineno: 6, content: "" },
        { origin: " ", old_lineno: 5, new_lineno: 7, content: "export function DiffViewer() {" },
        { origin: " ", old_lineno: 6, new_lineno: 8, content: "  const diff = useStore(s => s.diffResult);" },
        { origin: " ", old_lineno: 7, new_lineno: 9, content: "  const files = diff?.files ?? [];" },
      ],
    },
  ],
  old_content: `\
import React, { useState, useCallback } from 'react';
import { DiffLayout } from '../types';
import { useStore } from '../store';

export function DiffViewer() {
  const diff = useStore(s => s.diffResult);
  const files = diff?.files ?? [];

  // State
  const [layout, setLayout] = useState<DiffLayout>('split');
  const comments = useStore(s => s.comments);
  const handleClick = () => {
    console.log('clicked');
  };

  // TODO: implement comment submit
  return (
    <div className="diff-viewer">
      {/* ... */}
    </div>
  );
}`,
  new_content: `\
import React, { useState, useCallback } from 'react';
import { DiffLayout } from '../types';
import { useStore } from '../store';
import { formatLineRange } from '../utils/format-helpers';
import { copyToClipboard } from '../utils/clipboard';

export function DiffViewer() {
  const diff = useStore(s => s.diffResult);
  const files = diff?.files ?? [];

  // State
  const [layout, setLayout] = useState<DiffLayout>('split');
  const comments = useStore(s => s.comments);
  const handleClick = () => {
    console.log('clicked');
  };

  // TODO: implement comment submit
  return (
    <div className="diff-viewer">
      {/* ... */}
    </div>
  );
}`,
};

// ─── Unstaged variant: DiffViewer.tsx (handlers only) ───────────────────

const modifiedFileWorking: FileDiff = {
  file: {
    path: "src/components/DiffViewer.tsx",
    old_path: null,
    status: "modified",
    additions: 16,
    deletions: 5,
    is_binary: false,
    is_generated: false,
  },
  hunks: [
    {
      header: "@@ -12,8 +12,21 @@ export function DiffViewer() {",
      old_start: 12,
      old_lines: 8,
      new_start: 12,
      new_lines: 21,
      lines: [
        { origin: " ", old_lineno: 12, new_lineno: 12, content: "  const [layout, setLayout] = useState<DiffLayout>('split');" },
        { origin: " ", old_lineno: 13, new_lineno: 13, content: "  const comments = useStore(s => s.comments);" },
        { origin: "-", old_lineno: 14, new_lineno: null, content: "  const handleClick = () => {" },
        { origin: "-", old_lineno: 15, new_lineno: null, content: "    console.log('clicked');" },
        { origin: "+", old_lineno: null, new_lineno: 14, content: "  const handleLineSelect = useCallback((file: string, line: number) => {" },
        { origin: "+", old_lineno: null, new_lineno: 15, content: "    setSelectedLine({ file, line });" },
        { origin: "+", old_lineno: null, new_lineno: 16, content: "    setCommentFormOpen(true);" },
        { origin: " ", old_lineno: 16, new_lineno: 17, content: "  };" },
        { origin: " ", old_lineno: 17, new_lineno: 18, content: "" },
        { origin: "-", old_lineno: 18, new_lineno: null, content: "  // TODO: implement comment submit" },
        { origin: "+", old_lineno: null, new_lineno: 19, content: "  const handleCommentSubmit = useCallback((body: string) => {" },
        { origin: "+", old_lineno: null, new_lineno: 20, content: "    const range = formatLineRange(selectedLine.line, selectedLine.line);" },
        { origin: "+", old_lineno: null, new_lineno: 21, content: "    addComment({ file: selectedLine.file, line: selectedLine.line, body });" },
        { origin: "+", old_lineno: null, new_lineno: 22, content: "    setCommentFormOpen(false);" },
        { origin: "+", old_lineno: null, new_lineno: 23, content: "  }, [selectedLine]);" },
        { origin: "+", old_lineno: null, new_lineno: 24, content: "" },
        { origin: "+", old_lineno: null, new_lineno: 25, content: "  const handleCopyComment = useCallback(async (comment: ReviewComment) => {" },
        { origin: "+", old_lineno: null, new_lineno: 26, content: "    const text = `${comment.file}:L${comment.line} ${comment.body}`;" },
        { origin: "+", old_lineno: null, new_lineno: 27, content: "    await copyToClipboard(text);" },
        { origin: "+", old_lineno: null, new_lineno: 28, content: "  }, []);" },
        { origin: "+", old_lineno: null, new_lineno: 29, content: "" },
        { origin: " ", old_lineno: 19, new_lineno: 30, content: "  return (" },
        { origin: " ", old_lineno: 20, new_lineno: 31, content: "    <div className=\"diff-viewer\">" },
      ],
    },
  ],
  old_content: null,
  new_content: null,
};

// ─── Staged variant: diff.rs (sort logic only) ─────────────────────────

const rustCommandFileStaged: FileDiff = {
  file: {
    path: "src-tauri/src/commands/diff.rs",
    old_path: null,
    status: "modified",
    additions: 13,
    deletions: 2,
    is_binary: false,
    is_generated: false,
  },
  hunks: [
    {
      header: "@@ -22,9 +22,19 @@ pub fn get_diff(state: State<'_, AppState>) -> Result<DiffResult, AppError> {",
      old_start: 22,
      old_lines: 9,
      new_start: 22,
      new_lines: 19,
      lines: [
        { origin: " ", old_lineno: 22, new_lineno: 22, content: "    let repo = state.repo.lock().map_err(|_| AppError::LockError)?;" },
        { origin: " ", old_lineno: 23, new_lineno: 23, content: "    let diff = repo.diff_index_to_workdir(None, None)?;" },
        { origin: " ", old_lineno: 24, new_lineno: 24, content: "" },
        { origin: "-", old_lineno: 25, new_lineno: null, content: "    let files = parse_diff(&diff)?;" },
        { origin: "-", old_lineno: 26, new_lineno: null, content: "    let stats = compute_stats(&files);" },
        { origin: "+", old_lineno: null, new_lineno: 25, content: "    let mut files = parse_diff(&diff)?;" },
        { origin: "+", old_lineno: null, new_lineno: 26, content: "" },
        { origin: "+", old_lineno: null, new_lineno: 27, content: "    // Sort files: modified first, then added, deleted, renamed" },
        { origin: "+", old_lineno: null, new_lineno: 28, content: "    files.sort_by(|a, b| {" },
        { origin: "+", old_lineno: null, new_lineno: 29, content: "        let priority = |f: &FileDiff| match f.file.status {" },
        { origin: "+", old_lineno: null, new_lineno: 30, content: "            FileStatus::Modified => 0," },
        { origin: "+", old_lineno: null, new_lineno: 31, content: "            FileStatus::Added => 1," },
        { origin: "+", old_lineno: null, new_lineno: 32, content: "            FileStatus::Deleted => 2," },
        { origin: "+", old_lineno: null, new_lineno: 33, content: "            _ => 3," },
        { origin: "+", old_lineno: null, new_lineno: 34, content: "        };" },
        { origin: "+", old_lineno: null, new_lineno: 35, content: "        priority(a).cmp(&priority(b))" },
        { origin: "+", old_lineno: null, new_lineno: 36, content: "    });" },
        { origin: "+", old_lineno: null, new_lineno: 37, content: "" },
        { origin: "+", old_lineno: null, new_lineno: 38, content: "    let stats = compute_stats(&files);" },
        { origin: " ", old_lineno: 27, new_lineno: 39, content: "" },
        { origin: " ", old_lineno: 28, new_lineno: 40, content: "    Ok(DiffResult { files, stats })" },
        { origin: " ", old_lineno: 29, new_lineno: 41, content: "}" },
      ],
    },
  ],
  old_content: null,
  new_content: null,
};

// ─── Unstaged variant: diff.rs (log line only) ─────────────────────────

const rustCommandFileWorking: FileDiff = {
  file: {
    path: "src-tauri/src/commands/diff.rs",
    old_path: null,
    status: "modified",
    additions: 2,
    deletions: 1,
    is_binary: false,
    is_generated: false,
  },
  hunks: [
    {
      header: "@@ -37,7 +37,8 @@",
      old_start: 37,
      old_lines: 4,
      new_start: 37,
      new_lines: 5,
      lines: [
        { origin: " ", old_lineno: 37, new_lineno: 37, content: "    let stats = compute_stats(&files);" },
        { origin: " ", old_lineno: 38, new_lineno: 38, content: "" },
        { origin: "-", old_lineno: 39, new_lineno: null, content: "    Ok(DiffResult { files, stats })" },
        { origin: "+", old_lineno: null, new_lineno: 39, content: "    log::info!(\"Computed diff: {} files changed\", stats.files_changed);" },
        { origin: "+", old_lineno: null, new_lineno: 40, content: "    Ok(DiffResult { files, stats })" },
        { origin: " ", old_lineno: 40, new_lineno: 41, content: "}" },
      ],
    },
  ],
  old_content: null,
  new_content: null,
};

// ─── Unstaged-only new file ─────────────────────────────────────────────

const newUnstagedFile: FileDiff = {
  file: {
    path: "src/utils/logger.ts",
    old_path: null,
    status: "added",
    additions: 12,
    deletions: 0,
    is_binary: false,
    is_generated: false,
  },
  hunks: [
    {
      header: "@@ -0,0 +1,12 @@",
      old_start: 0,
      old_lines: 0,
      new_start: 1,
      new_lines: 12,
      lines: [
        { origin: "+", old_lineno: null, new_lineno: 1, content: "type LogLevel = 'debug' | 'info' | 'warn' | 'error';" },
        { origin: "+", old_lineno: null, new_lineno: 2, content: "" },
        { origin: "+", old_lineno: null, new_lineno: 3, content: "const LOG_LEVELS: Record<LogLevel, number> = {" },
        { origin: "+", old_lineno: null, new_lineno: 4, content: "  debug: 0, info: 1, warn: 2, error: 3," },
        { origin: "+", old_lineno: null, new_lineno: 5, content: "};" },
        { origin: "+", old_lineno: null, new_lineno: 6, content: "" },
        { origin: "+", old_lineno: null, new_lineno: 7, content: "let currentLevel: LogLevel = 'info';" },
        { origin: "+", old_lineno: null, new_lineno: 8, content: "" },
        { origin: "+", old_lineno: null, new_lineno: 9, content: "export function log(level: LogLevel, message: string): void {" },
        { origin: "+", old_lineno: null, new_lineno: 10, content: "  if (LOG_LEVELS[level] >= LOG_LEVELS[currentLevel]) {" },
        { origin: "+", old_lineno: null, new_lineno: 11, content: "    console[level](`[${level.toUpperCase()}] ${message}`);" },
        { origin: "+", old_lineno: null, new_lineno: 12, content: "  }" },
      ],
    },
  ],
  old_content: null,
  new_content: `\
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0, info: 1, warn: 2, error: 3,
};

let currentLevel: LogLevel = 'info';

export function log(level: LogLevel, message: string): void {
  if (LOG_LEVELS[level] >= LOG_LEVELS[currentLevel]) {
    console[level](\`[\${level.toUpperCase()}] \${message}\`);
  }
}`,
};

// ─── Assemble ────────────────────────────────────────────────────────────

const allFiles: FileDiff[] = [
  modifiedFile,
  addedFile,
  deletedFile,
  renamedFile,
  cssTokensFile,
  rustCommandFile,
  packageJsonFile,
  hookFile,
  docsFile,
  lockFile,
];

// Staged = HEAD vs index
// - staged-only: addedFile, deletedFile, cssTokensFile
// - both (staged part): modifiedFileStaged, rustCommandFileStaged
// - renamed (staged): renamedFile
// - package.json staged
const stagedFiles: FileDiff[] = [
  modifiedFileStaged,
  addedFile,
  deletedFile,
  renamedFile,
  cssTokensFile,
  rustCommandFileStaged,
  packageJsonFile,
];

// Working = index vs workdir
// - unstaged-only: hookFile, docsFile, lockFile, newUnstagedFile
// - both (unstaged part): modifiedFileWorking, rustCommandFileWorking
const workingFiles: FileDiff[] = [
  modifiedFileWorking,
  rustCommandFileWorking,
  hookFile,
  docsFile,
  newUnstagedFile,
  lockFile,
];

function computeStats(files: FileDiff[]): DiffStats {
  return {
    files_changed: files.length,
    additions: files.reduce((sum, f) => sum + f.file.additions, 0),
    deletions: files.reduce((sum, f) => sum + f.file.deletions, 0),
  };
}

export const mockDiffResult: DiffResult = {
  files: allFiles,
  stats: computeStats(allFiles),
};

export const mockStagedDiffResult: DiffResult = {
  files: stagedFiles,
  stats: computeStats(stagedFiles),
};

export const mockWorkingDiffResult: DiffResult = {
  files: workingFiles,
  stats: computeStats(workingFiles),
};

export const emptyDiffResult: DiffResult = {
  files: [],
  stats: { files_changed: 0, additions: 0, deletions: 0 },
};
