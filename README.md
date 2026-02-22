# Tasuki（襷）

Tasuki は、Claude Code と人間が襷を渡し合いながらゴールに向かうためのレビュー補助ツールです。

```
  Claude Code 🏃 ──→ 🎌 Tasuki 🎌 ──→ 🏃 人間
       作業完了        設計書+差分を      設計書を参照しながら
                       統合表示          差分にコメント
                                        「Copy All」→ ペースト
```

## Features

- **設計書ビューア**: Markdown 整形表示、Mermaid ダイアグラム描画、TOC 自動生成
- **差分ビューア**: GitHub 風 Files Changed UI、Split/Unified 切り替え、Scroll/Wrap 切り替え
- **レビューコメント**: 行レベルのコメント追加、範囲選択対応、コメント解決/取消
- **Copy All Prompt**: 構造化レビューをクリップボードにコピー（`ファイルパス:L行番号` 形式）
- **Approve / Reject**: 全コメント解決後に Approve、または Reject でレビュー判定
- **コミットゲート**: Claude Code Hook と連携し、レビュー承認なしのコミットを防止
- **4つの表示モード**: Docs / Diff / Diff + Docs / Terminal
- **ターミナル**: xterm.js + PTY による統合ターミナル（設計書と横並び表示）
- **diff 内検索**: Cmd/Ctrl+F で diff 内のテキスト検索
- **設計書連携**: `~/.claude/designs/{repo}/` 内の設計ドキュメントを表示
- **ファイル監視**: リアルタイムで変更を検出・更新（500ms デバウンス）
- **レビュー永続化**: HEAD SHA ベースでレビューセッションを保存・復元
- **自動生成ファイル折りたたみ**: lock ファイル等をデフォルトで折りたたみ

## CLI Usage

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
```

## Development

### Prerequisites

- Node.js 20+
- Rust 1.77+
- npm (or pnpm)
- System libraries for Tauri (see [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/))

### Setup

```bash
npm install
```

### Dev

```bash
# フロントエンドのみ（ブラウザ開発、モックデータ使用）
npm run dev

# Tauri デスクトップアプリとして起動
npm run tauri dev
```

### Build

```bash
npm run tauri build
```

### Test

```bash
npm test              # ユニットテスト（Vitest）
npm run test:e2e      # E2E テスト（Playwright）
npm run lint          # ESLint
npm run build         # TypeScript コンパイル + Vite ビルド
```

## Tech Stack

| 領域 | 技術 |
|------|------|
| アプリフレームワーク | Tauri 2.x |
| フロントエンド | React 19 + Vite 7 + TypeScript 5.9 |
| 状態管理 | Zustand 5 |
| Diff 描画 | @pierre/diffs（Shadow DOM 内でレンダリング） |
| Markdown | react-markdown + remark-gfm + rehype |
| Mermaid | beautiful-mermaid |
| シンタックスハイライト | Shiki |
| ターミナル | xterm.js 6 + portable-pty (Rust) |
| Git 操作 | git2-rs (Rust) |
| ファイル監視 | notify (Rust) |
| クリップボード | Tauri clipboard plugin |
| テスト | Vitest (unit) + Playwright (e2e) |

## Architecture

内部設計の詳細は [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) を参照してください。

## License

MIT
