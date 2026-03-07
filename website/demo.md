---
layout: page
title: Live Demo
---

# Live Demo

Experience Tasuki's review interface directly in your browser. This demo uses mock data — no git repository required.

<div style="margin: 24px 0;">
  <a href="/tasuki/app/" target="_blank" rel="noopener" style="display: inline-block; padding: 12px 24px; background: var(--vp-c-brand-1); color: #fff; border-radius: 8px; text-decoration: none; font-weight: 600;">
    Open Demo →
  </a>
</div>

## What you'll see

The demo includes **10 changed files** across multiple languages:

| File | Type | Highlights |
|------|------|-----------|
| `DiffViewer.tsx` | Modified | Multi-hunk React component refactoring |
| `format-helpers.ts` | Added | New utility functions |
| `legacy-helpers.ts` | Deleted | Removed deprecated code |
| `clipboard.ts` | Renamed | From `copy-utils.ts` with API changes |
| `tokens.css` | Modified | Design token updates |
| `commands/diff.rs` | Modified | Rust backend changes |
| `package.json` | Modified | Dependency additions |
| `useFileWatcher.ts` | Modified | Long lines for Scroll/Wrap demo |
| `USAGE_EXAMPLES.md` | Modified | Documentation updates |
| `package-lock.json` | Generated | Auto-collapsed lockfile |

## Try these features

1. **Switch views** — Toggle between Split and Unified in the toolbar
2. **Add a comment** — Click any line number's `+` button
3. **Read docs** — Click a document in the sidebar to view it alongside the diff
4. **Copy comments** — Use the clipboard button or "Copy All" in the Review Panel
5. **Zoom diagrams** — Hover over a Mermaid diagram and click the zoom icon
