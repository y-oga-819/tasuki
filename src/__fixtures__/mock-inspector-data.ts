import type { MethodInspectionResult } from "../types";

/**
 * Mock source code for files referenced in inspector demo.
 * Used by readFile mock to return realistic code when previewing callers/callees.
 */
export const mockSourceFiles: Record<string, string> = {
  // ---- DiffViewer.tsx: the main file with changed methods ----
  "src/components/DiffViewer.tsx": `\
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
  }, []);

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
      <Toolbar layout={layout} onLayoutChange={setLayout} />
      {files.map(file => (
        <FileSection
          key={file.path}
          file={file}
          layout={layout}
          onLineSelect={handleLineSelect}
        />
      ))}
      {commentFormOpen && (
        <CommentForm onSubmit={handleCommentSubmit} onCancel={() => setCommentFormOpen(false)} />
      )}
    </div>
  );
}`,

  // ---- format-helpers.ts: new utility file ----
  "src/utils/format-helpers.ts": `\
/**
 * Format a line range for display.
 * Single line: "L42", Range: "L10-L15"
 */
export function formatLineRange(start: number, end: number): string {
  if (start === end) return \`L\${start}\`;
  return \`L\${start}-L\${end}\`;
}

/**
 * Format a file path for compact display.
 * Removes common prefixes like 'src/'.
 */
export function formatFilePath(path: string): string {
  return path.replace(/^src\\//, '');
}

/**
 * Format a review comment for clipboard copy.
 */
export function formatComment(file: string, line: number, body: string): string {
  return \`\${file}:L\${line}\\n> \${body}\`;
}

/**
 * Generate a summary line for a list of comments.
 */
export function formatReviewSummary(count: number, resolved: number): string {
  return \`\${count} comment(s), \${resolved} resolved\`;
}`,

  // ---- App.tsx: parent component that calls DiffViewer ----
  "src/App.tsx": `\
import React, { useEffect } from 'react';
import { DiffViewer } from './components/DiffViewer';
import { ReviewPanel } from './components/ReviewPanel';
import { Sidebar } from './components/Sidebar';
import { useStore } from './store';
import { loadDiff, loadDocs } from './utils/api';

export function App() {
  const setDiff = useStore(s => s.setDiffResult);
  const setDocs = useStore(s => s.setDocs);
  const displayMode = useStore(s => s.displayMode);

  useEffect(() => {
    loadDiff().then(setDiff);
    loadDocs().then(setDocs);
  }, [setDiff, setDocs]);

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        {displayMode === 'diff' && <DiffViewer />}
        {displayMode === 'review' && <ReviewPanel />}
      </main>
    </div>
  );
}`,

  // ---- ReviewPanel.tsx: uses handleCommentSubmit pattern ----
  "src/components/ReviewPanel.tsx": `\
import React, { useCallback, useState } from 'react';
import { useStore } from '../store';
import { copyToClipboard } from '../utils/clipboard';
import { formatComment, formatReviewSummary } from '../utils/format-helpers';

export function ReviewPanel() {
  const comments = useStore(s => s.comments);
  const [filter, setFilter] = useState<'all' | 'unresolved'>('all');

  const filtered = filter === 'all'
    ? comments
    : comments.filter(c => !c.resolved);

  const handleCopy = useCallback(async (comment: ReviewComment) => {
    const text = formatComment(comment.file, comment.line, comment.body);
    await copyToClipboard(text);
  }, []);

  const handleCopyAll = useCallback(async () => {
    const text = comments
      .map(c => formatComment(c.file, c.line, c.body))
      .join('\\n\\n');
    await copyToClipboard(text);
  }, [comments]);

  const summary = formatReviewSummary(
    comments.length,
    comments.filter(c => c.resolved).length,
  );

  return (
    <div className="review-panel">
      <div className="review-header">
        <h2>Review Comments</h2>
        <span className="summary">{summary}</span>
        <button onClick={handleCopyAll} disabled={comments.length === 0}>
          Copy All
        </button>
      </div>
      <div className="filter-tabs">
        <button onClick={() => setFilter('all')}>All</button>
        <button onClick={() => setFilter('unresolved')}>Unresolved</button>
      </div>
      <ul className="comment-list">
        {filtered.map(comment => (
          <li key={comment.id} className="comment-item">
            <span className="comment-location">
              {comment.file}:L{comment.line}
            </span>
            <p className="comment-body">{comment.body}</p>
            <button onClick={() => handleCopy(comment)}>Copy</button>
          </li>
        ))}
      </ul>
    </div>
  );
}`,

  // ---- clipboard.ts: utility used by both components ----
  "src/utils/clipboard.ts": `\
/**
 * Copy text to clipboard.
 * Uses Tauri clipboard API in desktop, navigator.clipboard in browser.
 */
export async function copyToClipboard(text: string): Promise<void> {
  if (typeof window !== 'undefined' && '__TAURI__' in window) {
    const { writeText } = await import('@tauri-apps/plugin-clipboard-manager');
    await writeText(text);
  } else {
    await navigator.clipboard.writeText(text);
  }
}

/**
 * Read text from clipboard.
 */
export async function readFromClipboard(): Promise<string> {
  if (typeof window !== 'undefined' && '__TAURI__' in window) {
    const { readText } = await import('@tauri-apps/plugin-clipboard-manager');
    return await readText();
  }
  return await navigator.clipboard.readText();
}`,

  // ---- Sidebar.tsx: calls DiffViewer indirectly ----
  "src/components/Sidebar.tsx": `\
import React from 'react';
import { useStore } from '../store';

export function Sidebar() {
  const files = useStore(s => s.diffResult?.files ?? []);
  const selectedFile = useStore(s => s.selectedFile);
  const setSelectedFile = useStore(s => s.setSelectedFile);

  return (
    <aside className="sidebar">
      <section className="file-list">
        <h3>Changed Files</h3>
        <ul>
          {files.map(f => (
            <li
              key={f.file.path}
              className={f.file.path === selectedFile ? 'active' : ''}
              onClick={() => setSelectedFile(f.file.path)}
            >
              <span className={\`status-icon status-\${f.file.status}\`} />
              <span className="file-name">{f.file.path}</span>
              <span className="stats">
                +{f.file.additions} -{f.file.deletions}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}`,
};

/**
 * Mock inspector analysis results.
 * File paths match mockDiffResult files so the demo is coherent.
 */
export const mockInspectorResults: MethodInspectionResult[] = [
  {
    name: "handleLineSelect",
    file_path: "src/components/DiffViewer.tsx",
    start_line: 13,
    end_line: 16,
    changed_lines: [13, 14, 15, 16],
    change_type: "added",
    definition_code:
`  const handleLineSelect = useCallback((file: string, line: number) => {
    setSelectedLine({ file, line });
    setCommentFormOpen(true);
  }, []);`,
    callers: [
      {
        name: "DiffViewer",
        kind: "function",
        file_path: "src/components/DiffViewer.tsx",
        line: 6,
        character: 0,
        code_snippet: "export function DiffViewer() {",
      },
    ],
    callees: [],
    hover_info: "const handleLineSelect: (file: string, line: number) => void",
  },
  {
    name: "handleCommentSubmit",
    file_path: "src/components/DiffViewer.tsx",
    start_line: 18,
    end_line: 22,
    changed_lines: [18, 19, 20, 21, 22],
    change_type: "added",
    definition_code:
`  const handleCommentSubmit = useCallback((body: string) => {
    const range = formatLineRange(selectedLine.line, selectedLine.line);
    addComment({ file: selectedLine.file, line: selectedLine.line, body });
    setCommentFormOpen(false);
  }, [selectedLine]);`,
    callers: [
      {
        name: "DiffViewer",
        kind: "function",
        file_path: "src/components/DiffViewer.tsx",
        line: 6,
        character: 0,
        code_snippet: "export function DiffViewer() {",
      },
    ],
    callees: [
      {
        name: "formatLineRange",
        kind: "function",
        file_path: "src/utils/format-helpers.ts",
        line: 5,
        character: 0,
        code_snippet: "export function formatLineRange(start: number, end: number): string {",
      },
    ],
    hover_info: "const handleCommentSubmit: (body: string) => void",
  },
  {
    name: "handleCopyComment",
    file_path: "src/components/DiffViewer.tsx",
    start_line: 24,
    end_line: 27,
    changed_lines: [24, 25, 26, 27],
    change_type: "added",
    definition_code:
`  const handleCopyComment = useCallback(async (comment: ReviewComment) => {
    const text = \`\${comment.file}:L\${comment.line} \${comment.body}\`;
    await copyToClipboard(text);
  }, []);`,
    callers: [
      {
        name: "DiffViewer",
        kind: "function",
        file_path: "src/components/DiffViewer.tsx",
        line: 6,
        character: 0,
        code_snippet: "export function DiffViewer() {",
      },
    ],
    callees: [
      {
        name: "copyToClipboard",
        kind: "function",
        file_path: "src/utils/clipboard.ts",
        line: 4,
        character: 0,
        code_snippet: "export async function copyToClipboard(text: string): Promise<void> {",
      },
    ],
    hover_info: "const handleCopyComment: (comment: ReviewComment) => Promise<void>",
  },
  {
    name: "formatLineRange",
    file_path: "src/utils/format-helpers.ts",
    start_line: 5,
    end_line: 8,
    changed_lines: [5, 6, 7, 8],
    change_type: "added",
    definition_code:
`export function formatLineRange(start: number, end: number): string {
  if (start === end) return \`L\${start}\`;
  return \`L\${start}-L\${end}\`;
}`,
    callers: [
      {
        name: "handleCommentSubmit",
        kind: "function",
        file_path: "src/components/DiffViewer.tsx",
        line: 18,
        character: 0,
        code_snippet: "    const range = formatLineRange(selectedLine.line, selectedLine.line);",
      },
      {
        name: "handleCopy",
        kind: "function",
        file_path: "src/components/ReviewPanel.tsx",
        line: 12,
        character: 0,
        code_snippet: "    const text = formatComment(comment.file, comment.line, comment.body);",
      },
    ],
    callees: [],
    hover_info: "function formatLineRange(start: number, end: number): string",
  },
  {
    name: "formatFilePath",
    file_path: "src/utils/format-helpers.ts",
    start_line: 13,
    end_line: 16,
    changed_lines: [13, 14, 15, 16],
    change_type: "added",
    definition_code:
`export function formatFilePath(path: string): string {
  return path.replace(/^src\\//, '');
}`,
    callers: [
      {
        name: "Sidebar",
        kind: "function",
        file_path: "src/components/Sidebar.tsx",
        line: 5,
        character: 0,
        code_snippet: "export function Sidebar() {",
      },
    ],
    callees: [],
    hover_info: "function formatFilePath(path: string): string",
  },
];
