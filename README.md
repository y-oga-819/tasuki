# Tasuki（襷）

[![CI](https://github.com/y-oga-819/tasuki/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/y-oga-819/tasuki/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/y-oga-819/tasuki)](https://github.com/y-oga-819/tasuki/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform: macOS](https://img.shields.io/badge/platform-macOS-lightgrey.svg)]()
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)]()

A review assistant tool where Claude Code and humans pass the *tasuki* (relay sash) to reach the goal together.

[日本語版 / Japanese](#日本語)

```
  Claude Code 🏃 ──→ 🎌 Tasuki 🎌 ──→ 🏃 Human
     Work done       Show design docs    Review diffs with
                     + diffs together    design docs side by side
                                         "Copy All" → paste back
```

## Features

- **Design Doc Viewer** — Markdown rendering, Mermaid diagrams, auto-generated TOC
- **Diff Viewer** — GitHub-style Files Changed UI, Split/Unified toggle, Scroll/Wrap toggle
- **Line Comments** — Add comments per line or range, resolve/unresolve
- **Copy All** — Copy structured review to clipboard (`file:L123` format)
- **Approve / Reject** — Approve after resolving all comments, or Reject
- **Commit Gate** — Claude Code Hook integration to block commits until review is approved
- **3 View Modes** — Diff / Split (Diff + Docs / Terminal / Review) / Viewer (Docs + Terminal)
- **Integrated Terminal** — xterm.js + PTY, side-by-side with design docs
- **Diff Search** — Cmd/Ctrl+F to search within diffs
- **Design Doc Integration** — Display design docs from `~/.claude/designs/{repo}/`
- **File Watching** — Real-time change detection (500ms debounce)
- **Review Persistence** — Save/restore review sessions based on HEAD SHA
- **Auto-collapse Generated Files** — Lock files etc. collapsed by default

## CLI Usage

```bash
# Basic: launch in review mode
tasuki                    # Show latest uncommitted changes
tasuki .                  # Same as above
tasuki staged             # Staged changes only
tasuki working            # Unstaged changes only

# Specify a diff target
tasuki HEAD~3             # Diff against 3 commits ago
tasuki feature main       # Compare branches
tasuki abc1234            # Diff for a specific commit

# Design doc viewer only
tasuki docs               # List .md files under docs/
tasuki docs architecture.md  # Show a specific doc

# Initialize commit gate hook
tasuki init               # Set up Claude Code commit gate hook
```

## Commit Gate (Claude Code Hook)

Intercepts `git commit` in Claude Code, blocking commits until the review is approved in Tasuki.

### Setup

**1. Copy the hook script**

```bash
cp hooks/tasuki-commit-gate.sh ~/.claude/hooks/tasuki-commit-gate.sh
chmod +x ~/.claude/hooks/tasuki-commit-gate.sh
```

**2. Register the hook in Claude Code settings**

Add the following to `~/.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "command": "~/.claude/hooks/tasuki-commit-gate.sh"
      }
    ]
  }
}
```

### How It Works

```
Claude Code runs git commit
  → Hook checks /tmp/tasuki/{repo}/{branch}/review.json
  → File missing or rejected → commit blocked
  → approved → commit allowed (review.json is consumed and deleted)
```

1. Claude Code attempts `git commit` → Hook blocks it
2. Open Tasuki, review the diff, add comments if needed
3. Resolve all comments, then click "Approve" → `review.json` is written
4. Claude Code retries `git commit` → Hook passes, commit succeeds

### Disabling

Remove the hook entry from `~/.claude/settings.json` to disable the commit gate.

## Development

### Prerequisites

- Node.js 20+
- Rust 1.77+
- npm
- System libraries for Tauri (see [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/))

### Setup

```bash
npm install
```

### Dev

```bash
# Frontend only (browser dev with mock data)
npm run dev

# Tauri desktop app
npm run tauri dev
```

### Build

```bash
npm run tauri build
```

### Test

```bash
npm test              # Unit tests (Vitest)
npm run test:e2e      # E2E tests (Playwright)
npm run lint          # ESLint
npm run build         # TypeScript compile + Vite build
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| App Framework | Tauri 2.x |
| Frontend | React 19 + Vite 7 + TypeScript 5.9 |
| State Management | Zustand 5 |
| Diff Rendering | @pierre/diffs (Shadow DOM) |
| Markdown | react-markdown + remark-gfm + rehype |
| Diagrams | beautiful-mermaid |
| Syntax Highlighting | Shiki |
| Virtualized List | react-window |
| Terminal | xterm.js 6 + portable-pty (Rust) |
| Git Operations | git2-rs (Rust) |
| File Watching | notify (Rust) |
| Clipboard | Tauri clipboard plugin |
| Testing | Vitest (unit) + Playwright (e2e) |

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for internal design details.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

[MIT](LICENSE)

---

# 日本語

Tasuki は、Claude Code と人間が襷を渡し合いながらゴールに向かうためのレビュー補助ツールです。

## 主な機能

- **設計書ビューア**: Markdown 整形表示、Mermaid ダイアグラム描画、TOC 自動生成
- **差分ビューア**: GitHub 風 Files Changed UI、Split/Unified 切り替え、Scroll/Wrap 切り替え
- **レビューコメント**: 行レベルのコメント追加、範囲選択対応、コメント解決/取消
- **Copy All**: 構造化レビューをクリップボードにコピー（`ファイルパス:L行番号` 形式）
- **Approve / Reject**: 全コメント解決後に Approve、または Reject でレビュー判定
- **コミットゲート**: Claude Code Hook と連携し、レビュー承認なしのコミットを防止
- **3つの表示モード**: Diff / Split（Diff + Docs / Terminal / Review）/ Viewer（Docs + Terminal）
- **ターミナル**: xterm.js + PTY による統合ターミナル（設計書と横並び表示）
- **diff 内検索**: Cmd/Ctrl+F で diff 内のテキスト検索
- **設計書連携**: `~/.claude/designs/{repo}/` 内の設計ドキュメントを表示
- **ファイル監視**: リアルタイムで変更を検出・更新（500ms デバウンス）
- **レビュー永続化**: HEAD SHA ベースでレビューセッションを保存・復元
- **自動生成ファイル折りたたみ**: lock ファイル等をデフォルトで折りたたみ

## CLI の使い方

```bash
# 基本: レビューモードで起動
tasuki                    # 最新の未コミット変更を表示
tasuki .                  # 同上
tasuki staged             # ステージング変更
tasuki working            # 未ステージ変更のみ

# 特定の差分を指定
tasuki HEAD~3             # 3コミット前との差分
tasuki feature main       # ブランチ間比較
tasuki abc1234            # 特定コミットの差分

# 設計書ビューア単体
tasuki docs               # docs/ 以下の .md を一覧表示
tasuki docs architecture.md  # 特定の設計書を表示

# コミットゲートフックの初期化
tasuki init               # Claude Code コミットゲートフックをセットアップ
```

## コミットゲート

Claude Code の `git commit` をインターセプトし、Tasuki でレビュー承認を得るまでコミットをブロックします。セットアップ方法は[英語セクション](#commit-gate-claude-code-hook)を参照してください。

## 開発

詳しいセットアップ手順は[英語セクション](#development)を参照してください。

## ライセンス

[MIT](LICENSE)
