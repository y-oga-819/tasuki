/** ドキュメントパス配列（listDocs の戻り値） */
export const mockDocPaths: string[] = [
  "docs/architecture.md",
  "docs/review-workflow.md",
  "docs/getting-started.md",
  "docs/adr/001-diff-library.md",
];

/** 設計書ファイル名配列（listDesignDocs の戻り値） */
export const mockDesignDocNames: string[] = [
  "0001_ui-improvements.md",
  "0002_fix-watcher-resource-leak.md",
  "0007_html-view-mode.html",
  "adr/0001_diff-rendering.md",
  "adr/0002_state-management.md",
];

/** レビュー結果ファイル名配列（listReviewDocs の戻り値） */
export const mockReviewDocNames: string[] = [
  "pr_y-oga-819_tasuki_16.md",
  "review_me_tasuki_20260301_001.md",
];

/** ドキュメントコンテンツ（readFile / readDesignDoc の戻り値） */
export const mockDocContents: Record<string, string> = {
  "docs/architecture.md": `# Architecture

## Overview

Tasuki is a code review assistant built with **Tauri v2** (Rust backend) and **React 19** (TypeScript frontend). It bridges the gap between AI-powered code generation and human review.

## Technology Stack

| Layer | Technology | Role |
|-------|-----------|------|
| Desktop Shell | Tauri v2 | Native window, file access, clipboard |
| Frontend | React 19 + Vite 7 | UI rendering |
| State | Zustand 5 | Global state management |
| Diff Rendering | @pierre/diffs | Shadow DOM diff viewer |
| Markdown | react-markdown + remark-gfm | Document rendering |
| Diagrams | beautiful-mermaid | Mermaid diagram rendering |
| Syntax | Shiki | Code highlighting |
| Terminal | xterm.js 6 + portable-pty | Embedded terminal |

## Component Structure

\`\`\`mermaid
graph TD
    A[App] --> B[Toolbar]
    A --> C[FileSidebar]
    A --> D[LayoutSwitch]
    D --> E[DiffOnlyLayout]
    D --> F[SplitLayout]
    D --> G[ViewerLayout]
    E --> H[DiffPane]
    F --> H
    F --> I[MarkdownViewer]
    G --> I
    G --> J[Terminal]
    H --> K[CommentForm]
    A --> L[ReviewPanel]
    L --> M[CommentList]
    style A fill:#2563eb,color:#fff
    style D fill:#16a34a,color:#fff
    style L fill:#ca8a04,color:#fff
\`\`\`

## Data Flow

\`\`\`mermaid
sequenceDiagram
    participant User
    participant App
    participant Store as Zustand Store
    participant Tauri as Tauri Backend
    participant Git

    User->>App: Launch tasuki
    App->>Tauri: get_diff()
    Tauri->>Git: diff HEAD..working
    Git-->>Tauri: raw diff
    Tauri-->>App: DiffResult
    App->>Store: setDiffResult()
    Store-->>App: re-render

    User->>App: Click line to comment
    App->>Store: addThread()
    Store-->>App: update ReviewPanel

    User->>App: Click "Approve"
    App->>Tauri: write_commit_gate()
    Tauri-->>App: OK
    Note over User,Git: Commit hook checks gate file
\`\`\`

## Directory Structure

\`\`\`
tasuki/
├── src/                    # React frontend
│   ├── components/         # UI components
│   ├── store/              # Zustand stores
│   ├── hooks/              # Custom React hooks
│   ├── utils/              # Utility functions
│   └── types/              # TypeScript types
├── src-tauri/              # Tauri / Rust backend
│   ├── src/commands/       # IPC command handlers
│   └── src/git/            # Git operations
├── e2e/                    # Playwright E2E tests
└── docs/                   # Project documentation
\`\`\`

## Key Design Decisions

1. **Shadow DOM for diffs** — \`@pierre/diffs\` renders inside Shadow DOM, providing style isolation but requiring special handling for E2E tests
2. **Zustand over Redux** — Minimal boilerplate, excellent TypeScript support, easy store slicing
3. **Commit gate pattern** — Review status is written to a JSON file that a git hook checks before allowing commits
4. **Mock-first development** — \`tauri-api.ts\` returns mock data when running outside Tauri, enabling pure-browser development
`,

  "docs/review-workflow.md": `# Review Workflow

## Overview

Tasuki enables a structured review workflow where Claude Code generates changes and a human reviews them through an intuitive diff viewer.

## The Review Loop

\`\`\`mermaid
flowchart LR
    A[Claude Code<br/>generates changes] --> B[tasuki<br/>reviews diff]
    B --> C{Human review}
    C -->|Comments| D[Copy to<br/>Claude Code]
    D --> A
    C -->|Approve| E[Commit allowed]
    C -->|Reject| F[Block commit]
    style B fill:#2563eb,color:#fff
    style E fill:#16a34a,color:#fff
    style F fill:#dc2626,color:#fff
\`\`\`

## Steps

### 1. Start Review

Launch tasuki in your git repository. It automatically detects uncommitted changes and displays them in a split diff view.

\`\`\`bash
# Review uncommitted changes
tasuki

# Review staged changes only
tasuki --staged

# Review diff against a branch
tasuki --ref main
\`\`\`

### 2. Review the Diff

- **Split view**: Side-by-side comparison (default)
- **Unified view**: Single column with additions/deletions inline
- **Scroll/Wrap**: Toggle long line handling
- **Expand/Collapse**: Show or hide unchanged context lines

### 3. Add Comments

Click on any line number to open a comment form. You can:

- Comment on a single line
- Select multiple lines and comment on the range
- Add suggestions with code snippets

### 4. Copy and Share

Each comment includes context:

\`\`\`
src/components/DiffViewer.tsx:L14
> setCommentFormOpen(true);
Consider debouncing this to avoid rapid open/close cycles.
\`\`\`

Use **Copy All** to export all comments at once:

\`\`\`markdown
## Review Result:

### src/components/DiffViewer.tsx

**L14** \`setCommentFormOpen(true);\`
Consider debouncing this to avoid rapid open/close cycles.

**L26** \`await copyToClipboard(text);\`
Should handle the case where clipboard API is not available.
\`\`\`

### 5. Approve or Reject

- **Approve**: All comments must be resolved first. Writes a gate file that allows the next commit.
- **Reject**: Blocks the commit and copies unresolved comments for the developer.

## Tips

> **Keyboard shortcuts**: Use \`Cmd/Ctrl+Enter\` to submit comments quickly, and \`Escape\` to cancel.

> **Document pane**: Switch to Split mode to read design docs alongside the diff — great for checking if implementation matches the spec.
`,

  "docs/getting-started.md": `# Getting Started

## Installation

### From Release

Download the latest release for your platform from [GitHub Releases](https://github.com/y-oga-819/tasuki/releases).

### From Source

\`\`\`bash
git clone https://github.com/y-oga-819/tasuki.git
cd tasuki
npm install
npm run tauri build
\`\`\`

## Quick Start

### 1. Basic Review

\`\`\`bash
cd your-project
tasuki
\`\`\`

This opens a window showing all uncommitted changes with a split diff view.

### 2. Add a Comment

1. Hover over a line number in the diff
2. Click the **+** button that appears
3. Type your comment
4. Press **Cmd/Ctrl+Enter** or click **Add Comment**

### 3. Copy Comments

- Click the clipboard icon next to any comment to copy it individually
- Click **Copy All** in the Review Panel to copy all comments

### 4. Review Verdict

| Action | Condition | Effect |
|--------|-----------|--------|
| Approve | All comments resolved | Writes gate file, allows commit |
| Reject | Any time | Blocks commit, exports comments |

## CLI Options

\`\`\`bash
tasuki                     # Review uncommitted changes
tasuki --staged            # Review staged changes only
tasuki --ref main          # Diff from main branch
tasuki --ref abc123        # Diff from specific commit
tasuki --ref v1.0..v2.0    # Diff between two refs
\`\`\`

## Browser Development

You can develop and preview the frontend without Tauri:

\`\`\`bash
npm run dev
# Open http://localhost:1420
\`\`\`

Mock data is automatically provided when running outside of Tauri.
`,

  "docs/adr/001-diff-library.md": `# ADR-001: Diff Library Selection

## Status

Accepted

## Context

We need a diff rendering library that supports:
- Split and unified views
- Line selection for commenting
- Shadow DOM encapsulation for style isolation
- High performance with large diffs

## Options Considered

| Library | Shadow DOM | Split View | Bundle Size |
|---------|-----------|------------|-------------|
| @pierre/diffs | Yes | Yes | 45KB |
| react-diff-viewer | No | Yes | 120KB |
| diff2html | No | Yes | 85KB |

## Decision

Use \`@pierre/diffs\` for diff rendering.

## Consequences

### Positive
- Shadow DOM encapsulation provides complete style isolation
- Small bundle size
- Built-in split and unified view support

### Negative
- Shadow DOM makes E2E testing harder (need \`pierce\` selectors)
- Custom events are needed for line selection
- Hover interactions are intercepted by Shadow DOM boundary
`,

  "0001_ui-improvements.md": `# Design: UI Improvements

## Goals

- Improve sidebar navigation with collapsible sections
- Add search functionality to diff viewer
- Enhance terminal split layout for better readability

## Proposed Changes

\`\`\`mermaid
flowchart TD
    A[Current UI] --> B[Collapsible Sidebar]
    A --> C[Diff Search Bar]
    A --> D[Resizable Terminal]
    B --> E[File tree grouping]
    B --> F[Section memory]
    C --> G[Regex support]
    C --> H[Match highlighting]
    D --> I[Drag handle]
    D --> J[Min/Max constraints]
\`\`\`

## Implementation Plan

### Phase 1: Sidebar
- Add collapsible sections for Changed Files, Documents, Design Docs
- Remember collapsed state in localStorage
- Group files by directory with tree view

### Phase 2: Search
- Implement \`Cmd/Ctrl+F\` search bar overlay
- Support regex and case-sensitive toggle
- Highlight matches across all visible hunks

### Phase 3: Terminal Layout
- Add drag handle between panes
- Set min width constraints (200px min, 900px max)
- Persist split ratio across sessions
`,

  "0002_fix-watcher-resource-leak.md": `# Design: Fix Watcher Resource Leak

## Problem

File watcher listeners accumulate on re-render, causing memory leaks. Each \`useEffect\` call in \`useFileWatcher\` adds a new listener without properly cleaning up the previous one.

## Root Cause

\`\`\`typescript
// Bug: cleanup function doesn't unsubscribe the event listener
useEffect(() => {
  tauriEvents.onFileChange(() => refresh());
  return () => {}; // ← missing unsubscribe
}, [refresh]);
\`\`\`

## Solution

\`\`\`typescript
// Fix: properly return the unsubscribe function
useEffect(() => {
  const unsubscribe = tauriEvents.onFileChange(() => refresh());
  return () => { unsubscribe(); };
}, [refresh]);
\`\`\`

## Impact

- Memory usage stabilizes after fix (no more listener accumulation)
- File change events fire exactly once per change
- CPU usage decreases in long-running sessions
`,

  "0007_html-view-mode.html": `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<title>HTML View Mode</title>
<style>
body { font-family: system-ui, sans-serif; background: #0a0a0a; color: #e4e4e7; max-width: 900px; margin: 0 auto; padding: 2rem; }
h1 { color: #818cf8; }
h2 { color: #a78bfa; border-bottom: 1px solid #27272a; padding-bottom: 0.5rem; }
table { border-collapse: collapse; width: 100%; }
th, td { border: 1px solid #3f3f46; padding: 8px 12px; text-align: left; }
th { background: #18181b; }
code { background: #27272a; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }
</style>
</head>
<body>
<h1>HTML View Mode - Mock Design Doc</h1>
<p>This is a mock HTML design document for browser development.</p>
<h2>Overview</h2>
<p>The HTML View Mode feature allows viewing <code>.html</code> design documents directly in Tasuki's document viewer.</p>
<h2>Key Decisions</h2>
<table>
<thead><tr><th>Decision</th><th>Choice</th><th>Reason</th></tr></thead>
<tbody>
<tr><td>Rendering</td><td>iframe + srcdoc</td><td>CSS/JS isolation</td></tr>
<tr><td>Sandbox</td><td>allow-scripts</td><td>Mermaid.js support</td></tr>
</tbody>
</table>
</body>
</html>`,

  "adr/0001_diff-rendering.md": `# ADR: Diff Rendering Library

## Status

Accepted

## Decision

Use @pierre/diffs with Shadow DOM encapsulation for diff rendering.

## Rationale

Shadow DOM provides complete style isolation between the diff viewer and the host application. This prevents CSS conflicts and ensures consistent rendering regardless of the application's global styles.

## Trade-offs

- **Pro**: Perfect style isolation
- **Pro**: Smaller bundle than alternatives
- **Con**: E2E tests need Shadow DOM piercing
- **Con**: Hover events require special handling
`,

  "adr/0002_state-management.md": `# ADR: State Management

## Status

Accepted

## Decision

Use Zustand for global state management due to its simplicity and minimal boilerplate.

## Comparison

| Feature | Zustand | Redux Toolkit | Jotai |
|---------|---------|--------------|-------|
| Boilerplate | Minimal | Moderate | Minimal |
| DevTools | Yes | Yes | Limited |
| TypeScript | Excellent | Good | Good |
| Bundle Size | 1.1KB | 11KB | 2.4KB |
| Store Slicing | Built-in | Manual | Atomic |

## Rationale

Zustand's subscribe-with-selector pattern enables fine-grained re-renders without the overhead of Redux's action/reducer pattern. The store can be easily sliced for testing and the API is intuitive for developers familiar with React hooks.
`,
};
