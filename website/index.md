---
layout: home

hero:
  name: Tasuki
  text: Code review assistant
  tagline: Relay the baton between Claude Code and human reviewers
  actions:
    - theme: brand
      text: Get Started
      link: /guide/what-is-tasuki
    - theme: alt
      text: Try the Demo
      link: /demo
    - theme: alt
      text: GitHub
      link: https://github.com/y-oga-819/tasuki

features:
  - icon: 🔍
    title: Rich Diff Viewer
    details: Split or unified view with syntax highlighting. Supports multi-language diffs including TypeScript, Rust, CSS, and Markdown.
  - icon: 💬
    title: Inline Comments
    details: Click any line to add a review comment. Select ranges for multi-line comments. Copy individual comments or all at once.
  - icon: 📄
    title: Document Pane
    details: Read design docs alongside the diff. Mermaid diagrams render as interactive SVGs with zoom support.
  - icon: 🔒
    title: Commit Gate
    details: Approve or reject changes. A git hook enforces the review verdict — unapproved code cannot be committed.
  - icon: 🖥️
    title: Embedded Terminal
    details: Run commands without leaving the review. Built-in terminal powered by xterm.js and portable-pty.
  - icon: ⚡
    title: Lightweight & Fast
    details: Built with Tauri v2 for minimal resource usage. No Electron overhead — the binary is under 10 MB.
---
