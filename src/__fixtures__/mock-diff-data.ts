import type { DiffStats, FileDiff, DiffResult } from "../types";

const modifiedFile: FileDiff = {
  file: {
    path: "src/components/DiffViewer.tsx",
    old_path: null,
    status: "modified",
    additions: 5,
    deletions: 2,
    is_binary: false,
    is_generated: false,
  },
  hunks: [
    {
      header: "@@ -10,8 +10,11 @@ export function DiffViewer() {",
      old_start: 10,
      old_lines: 8,
      new_start: 10,
      new_lines: 11,
      lines: [
        { origin: " ", old_lineno: 10, new_lineno: 10, content: "  const [layout, setLayout] = useState<DiffLayout>('split');" },
        { origin: " ", old_lineno: 11, new_lineno: 11, content: "  const comments = useStore(s => s.comments);" },
        { origin: "-", old_lineno: 12, new_lineno: null, content: "  const handleClick = () => {" },
        { origin: "-", old_lineno: 13, new_lineno: null, content: "    console.log('clicked');" },
        { origin: "+", old_lineno: null, new_lineno: 12, content: "  const handleLineSelect = (file: string, line: number) => {" },
        { origin: "+", old_lineno: null, new_lineno: 13, content: "    setSelectedLine({ file, line });" },
        { origin: "+", old_lineno: null, new_lineno: 14, content: "    setCommentFormOpen(true);" },
        { origin: " ", old_lineno: 14, new_lineno: 15, content: "  };" },
        { origin: " ", old_lineno: 15, new_lineno: 16, content: "" },
        { origin: "+", old_lineno: null, new_lineno: 17, content: "  const handleCommentSubmit = (body: string) => {" },
        { origin: "+", old_lineno: null, new_lineno: 18, content: "    addComment({ file: selectedLine.file, line: selectedLine.line, body });" },
        { origin: " ", old_lineno: 16, new_lineno: 19, content: "  return (" },
        { origin: " ", old_lineno: 17, new_lineno: 20, content: "    <div className=\"diff-viewer\">" },
      ],
    },
  ],
  old_content: `\
import React, { useState } from 'react';
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

  return (
    <div className="diff-viewer">
      {/* ... */}
    </div>
  );
}`,
  new_content: `\
import React, { useState } from 'react';
import { DiffLayout } from '../types';
import { useStore } from '../store';

export function DiffViewer() {
  const diff = useStore(s => s.diffResult);
  const files = diff?.files ?? [];

  // State
  const [layout, setLayout] = useState<DiffLayout>('split');
  const comments = useStore(s => s.comments);
  const handleLineSelect = (file: string, line: number) => {
    setSelectedLine({ file, line });
    setCommentFormOpen(true);
  };

  const handleCommentSubmit = (body: string) => {
    addComment({ file: selectedLine.file, line: selectedLine.line, body });
  return (
    <div className="diff-viewer">
      {/* ... */}
    </div>
  );
}`,
};

const addedFile: FileDiff = {
  file: {
    path: "src/utils/format-helpers.ts",
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
        { origin: "+", old_lineno: null, new_lineno: 1, content: "/**" },
        { origin: "+", old_lineno: null, new_lineno: 2, content: " * Format a line range for display." },
        { origin: "+", old_lineno: null, new_lineno: 3, content: " */" },
        { origin: "+", old_lineno: null, new_lineno: 4, content: "export function formatLineRange(start: number, end: number): string {" },
        { origin: "+", old_lineno: null, new_lineno: 5, content: "  if (start === end) return `L${start}`;" },
        { origin: "+", old_lineno: null, new_lineno: 6, content: "  return `L${start}-L${end}`;" },
        { origin: "+", old_lineno: null, new_lineno: 7, content: "}" },
        { origin: "+", old_lineno: null, new_lineno: 8, content: "" },
        { origin: "+", old_lineno: null, new_lineno: 9, content: "export function truncate(text: string, maxLen: number): string {" },
        { origin: "+", old_lineno: null, new_lineno: 10, content: "  if (text.length <= maxLen) return text;" },
        { origin: "+", old_lineno: null, new_lineno: 11, content: "  return text.slice(0, maxLen - 3) + '...';" },
        { origin: "+", old_lineno: null, new_lineno: 12, content: "}" },
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

export function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + '...';
}`,
};

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

const allFiles: FileDiff[] = [modifiedFile, addedFile, deletedFile, renamedFile];

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

export const emptyDiffResult: DiffResult = {
  files: [],
  stats: { files_changed: 0, additions: 0, deletions: 0 },
};
