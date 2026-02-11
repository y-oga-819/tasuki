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
- **差分ビューア**: GitHub 風 Files Changed UI、Split/Stacked 切り替え
- **レビューコメント**: 行レベルのコメント追加、範囲選択対応
- **Copy All Prompt**: 構造化レビューをクリップボードにコピー（`ファイルパス:L行番号` 形式）
- **3つの表示モード**: Docs / Diff / Diff + Docs
- **ファイル監視**: リアルタイムで変更を検出・更新
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
- pnpm
- System libraries for Tauri (see [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/))

### Setup

```bash
pnpm install
```

### Dev

```bash
pnpm tauri dev
```

### Build

```bash
pnpm tauri build
```

## Tech Stack

| 領域 | 技術 |
|------|------|
| アプリフレームワーク | Tauri 2.x |
| フロントエンド | React + Vite + TypeScript |
| 状態管理 | Zustand |
| Markdown | react-markdown + remark-gfm + rehype |
| Git操作 | git2-rs (Rust) |
| ファイル監視 | notify (Rust) |
| クリップボード | Tauri clipboard plugin |

## Architecture

内部設計の詳細は [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) を参照してください。

## License

MIT
