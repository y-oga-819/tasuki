# セットアップ

## インストール

### リリースからダウンロード

[GitHub Releases](https://github.com/y-oga-819/tasuki/releases)からお使いのプラットフォーム向けの最新リリースをダウンロードしてください。

| プラットフォーム | ファイル |
|----------------|---------|
| macOS (Apple Silicon) | `tasuki_x.x.x_aarch64.dmg` |
| macOS (Intel) | `tasuki_x.x.x_x64.dmg` |
| Linux (.deb) | `tasuki_x.x.x_amd64.deb` |
| Linux (.AppImage) | `tasuki_x.x.x_amd64.AppImage` |
| Windows | `tasuki_x.x.x_x64-setup.exe` |

### ソースからビルド

```bash
git clone https://github.com/y-oga-819/tasuki.git
cd tasuki
npm install
npm run tauri build
```

::: tip 前提条件
ソースからのビルドには [Node.js 22+](https://nodejs.org/)、[Rust](https://rustup.rs/)、およびTauri用のプラットフォーム固有の依存関係が必要です。[Tauriの前提条件ガイド](https://v2.tauri.app/start/prerequisites/)を参照してください。
:::

## クイックスタート

### 1. レビューを開始

```bash
cd your-project

# 未コミットの変更をすべてレビュー（デフォルト）
tasuki

# ステージされた変更のみレビュー
tasuki --staged

# ブランチからのdiffをレビュー
tasuki --ref main

# 特定のコミットをレビュー
tasuki --ref abc1234

# コミット範囲をレビュー
tasuki --ref v1.0..v2.0
```

### 2. Diffをナビゲート

- **サイドバー**にステータスアイコン付きの変更ファイル一覧が表示される
- ファイル名をクリックするとそのdiffまでスクロール
- **ツールバー**でSplit/Unifiedを切り替え

### 3. コメントを追加

1. 行番号にホバー — `+`ボタンが表示される
2. `+`をクリックしてコメントフォームを開く
3. コメントを入力
4. `Cmd/Ctrl+Enter` または **Add Comment** をクリック

複数行コメントは、先に行を範囲選択してください。

### 4. コピーして共有

- **単一コメント**: コメント横のクリップボードアイコンをクリック
- **全コメント**: Review Panelの **Copy All** をクリック

コピーされた形式にはファイルパス、行番号、コードコンテキストが含まれ、Claude Codeにそのまま貼り付けられます。

### 5. 判定

| アクション | 条件 | 効果 |
|-----------|------|------|
| **Approve** | 全コメント解決済み | ゲートファイルを書き込み、コミット許可 |
| **Reject** | いつでも可能 | コミットをブロック、コメントをエクスポート |

## キーボードショートカット

| キー | アクション |
|------|-----------|
| `Cmd/Ctrl+F` | Diff内検索 |
| `Cmd/Ctrl+Enter` | コメント送信 |
| `Escape` | フォーム/モーダルを閉じる |

## ブラウザ開発モード

Tauriアプリをビルドせずにフロントエンドをプレビューできます：

```bash
npm run dev
# http://localhost:1420 を開く
```

Tauri環境外ではモックデータが自動的に提供されるため、gitリポジトリなしでUI変更を開発・テストできます。
