/** ドキュメントパス配列（listDocs の戻り値） */
export const mockDocPaths: string[] = [
  "docs/architecture.md",
  "docs/review-workflow.md",
  "docs/adr/001-diff-library.md",
];

/** 設計書ファイル名配列（listDesignDocs の戻り値） */
export const mockDesignDocNames: string[] = [
  "0001_ui-improvements.md",
  "0002_fix-watcher-resource-leak.md",
];

/** ドキュメントコンテンツ（readFile / readDesignDoc の戻り値） */
export const mockDocContents: Record<string, string> = {
  "docs/architecture.md": `# Architecture

## Overview

Tasuki is a review tool built with Tauri + React.

## Component Structure

\`\`\`mermaid
graph TD
    A[App] --> B[Toolbar]
    A --> C[FileSidebar]
    A --> D[DiffViewer]
    A --> E[ReviewPanel]
    D --> F[CommentForm]
    E --> G[CommentList]
\`\`\`

## Data Flow

1. App initializes and fetches diff via \`tauri-api.ts\`
2. DiffResult is stored in Zustand store
3. Components subscribe to store slices
4. User actions dispatch store mutations
`,

  "docs/review-workflow.md": `# Review Workflow

## Steps

1. Open tasuki in a git repository
2. Review the diff in split or unified view
3. Click on lines to add comments
4. Copy individual comments or all at once
5. Paste into Claude Code or PR description

## Comment Format

Each comment includes:
- File path and line number
- Code snippet for context
- Comment body
`,

  "docs/adr/001-diff-library.md": `# ADR-001: Diff Library Selection

## Status

Accepted

## Context

We need a diff rendering library that supports:
- Split and unified views
- Line selection
- Shadow DOM encapsulation

## Decision

Use \`@pierre/diffs\` for diff rendering.

## Consequences

- Shadow DOM encapsulation provides style isolation
- Line selection events are emitted via custom events
- E2E tests need Shadow DOM piercing for assertions
`,

  "0001_ui-improvements.md": `# UI Improvements Design

## Goals

- Improve sidebar usability
- Add search functionality to diff viewer
- Enhance terminal split layout
`,

  "0002_fix-watcher-resource-leak.md": `# Fix Watcher Resource Leak

## Problem

File watcher listeners accumulate on re-render, causing memory leaks.

## Solution

Properly clean up event listeners in useEffect cleanup.
`,
};
