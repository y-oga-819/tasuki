# Tasuki アーキテクチャ設計書

> このドキュメントは Tasuki の内部設計を解説するものです。
> プロジェクトの概要・使い方・セットアップ手順については [README.md](../README.md) を参照してください。

## 1. コンセプト

### 背景と課題

AI がコードを生成・変更した後、人間がレビューする際に以下の問題がある：

1. **設計書と差分が別々のツールに分散** — 設計意図を理解しながらコードを読むのが困難
2. **レビューコメントの構造化が手間** — ファイルパスや行番号を手動で記述する必要がある
3. **AI へのフィードバックが非構造的** — 自然言語だけでは意図が正確に伝わらない

### ソリューション

Tasuki は駅伝の「襷リレー」のように、AI と人間が作業を交互に受け渡すワークフローを実現する。

```
  Claude Code 🏃 ──→ 🎌 Tasuki 🎌 ──→ 🏃 人間 ──→ 🏃 Claude Code
       作業完了        設計書+差分を      設計書を参照しながら     フィードバックを
                       統合表示          差分にコメント          受けて次の作業へ
                                        「Copy All」で出力
```

設計書と差分を一画面に統合表示し、行レベルのレビューコメントを構造化テキストとして出力することで、上記の課題を解決する。

### 設計原則

- **シンプルさ** — レビューに必要な機能だけに絞り、複雑な設定を排除する
- **Git ネイティブ** — 既存の Git ワークフローに自然に組み込める
- **オフライン完結** — ネットワーク接続不要、ローカルリポジトリだけで動作する
- **軽量・高速** — Tauri のネイティブバイナリにより起動・動作が高速

## 2. システムアーキテクチャ

### 技術選定

| 領域 | 技術 | 選定理由 |
|------|------|----------|
| アプリフレームワーク | Tauri 2.x | 軽量なネイティブアプリ、Rust バックエンドで Git 操作が高速 |
| フロントエンド | React 19 + TypeScript | 宣言的 UI、型安全性 |
| ビルドツール | Vite 7.x | 高速な開発サーバーと HMR |
| 状態管理 | Zustand 5.x | 最小限の API で十分な機能 |
| Markdown 描画 | react-markdown + remark/rehype | プラグインエコシステムが豊富 |
| コードハイライト | Shiki | 精度の高いシンタックスハイライト |
| Mermaid 描画 | beautiful-mermaid | Zero DOM 依存、超高速、CSS カスタムプロパティ対応 |
| ターミナルエミュレータ | xterm.js 6.x | 業界標準（VS Code, Hyper 等で採用）、WebGL2 GPU描画、Tauri との相性良好。ghostty-web（API互換だがPOC段階）、DomTerm（リッチだがニッチ）、hterm（DOM-only・npm未整備）等を比較検討した上で選定 |
| PTY | portable-pty | クロスプラットフォームの疑似端末ライブラリ、xterm.js と連携してリアルなシェルセッションを提供 |
| Git 操作 | git2-rs | シェル呼び出し不要、直接バインディングで安全かつ高速 |
| ファイル監視 | notify | OS ネイティブの監視 API を抽象化 |
| ハッシュ | sha2 | diff ハッシュ計算（レビュー永続化・コミットゲートの変更検知に使用） |

### 全体構成

```
┌─────────────────────────────────────────────────────────┐
│                    Tauri WebView                        │
│  ┌───────────────────────────────────────────────────┐  │
│  │              React Frontend (TypeScript)           │  │
│  │                                                    │  │
│  │  ┌──────────┐  ┌─────────────┐  ┌──────────────┐ │  │
│  │  │ Toolbar  │  │ FileSidebar │  │ MainContent  │ │  │
│  │  └──────────┘  └─────────────┘  │ ┌──────────┐ │ │  │
│  │                                  │ │DiffViewer│ │ │  │
│  │  ┌──────────────────────────┐   │ ├──────────┤ │ │  │
│  │  │     ReviewPanel          │   │ │ Markdown │ │ │  │
│  │  └──────────────────────────┘   │ │ Viewer   │ │ │  │
│  │                                  │ └──────────┘ │ │  │
│  │  ┌──────────────────────────┐   └──────────────┘ │  │
│  │  │     Zustand Store        │                     │  │
│  │  └──────────┬───────────────┘                     │  │
│  │             │ invoke()                            │  │
│  └─────────────┼─────────────────────────────────────┘  │
│                │  Tauri IPC Bridge                       │
│  ┌─────────────┼─────────────────────────────────────┐  │
│  │             ▼  Rust Backend                        │  │
│  │  ┌──────────────────┐  ┌─────────────────────┐    │  │
│  │  │   commands.rs    │  │    watcher.rs        │    │  │
│  │  │  (Tauri Commands)│  │  (File Monitoring)   │    │  │
│  │  └────────┬─────────┘  └──────────┬──────────┘    │  │
│  │           │                        │               │  │
│  │  ┌────────▼─────────┐    emit("files-changed")    │  │
│  │  │     git.rs       │              │               │  │
│  │  │  (git2 bindings) │              │               │  │
│  │  └────────┬─────────┘              │               │  │
│  │           │                        │               │  │
│  └───────────┼────────────────────────┼───────────────┘  │
└──────────────┼────────────────────────┼──────────────────┘
               │                        │
         ┌─────▼─────┐           ┌──────▼──────┐
         │ .git/     │           │ filesystem  │
         │ repository│           │ (watch)     │
         └───────────┘           └─────────────┘
```

### レイヤー構成

アプリケーションは 3 つのレイヤーで構成される：

1. **プレゼンテーション層** (React Components) — UI の描画とユーザーインタラクション
2. **アプリケーション層** (Zustand Store + Hooks) — 状態管理とビジネスロジック
3. **インフラ層** (Rust Backend) — Git 操作、ファイル I/O、OS 連携

各レイヤーは明確な境界を持ち、Tauri IPC を介して通信する。フロントエンドからバックエンドへの呼び出しは `tauri-api.ts` に集約されている。

## 3. バックエンド設計 (Rust)

### モジュール構成

```
src-tauri/src/
├── main.rs       # エントリーポイント（lib::run() を呼ぶだけ）
├── lib.rs        # CLI 引数パース、Tauri アプリ初期化
├── commands.rs   # Tauri コマンドハンドラ（フロントエンドとの橋渡し）
├── git.rs        # Git 操作の実装（git2-rs バインディング）
├── watcher.rs    # ファイルシステム監視
├── pty.rs        # PTY（疑似端末）管理、xterm.js と連携するシェルセッション
└── error.rs      # エラー型定義
```

### CLI 引数パース (`lib.rs`)

アプリ起動時の引数を解析し、表示モードを決定する。`CliArgs` は Tauri のマネージド状態として保持され、フロントエンドから `get_cli_args` コマンドで取得できる。

```
tasuki                  → mode="uncommitted"
tasuki staged           → mode="staged"
tasuki working          → mode="working"
tasuki HEAD~3           → mode="commit",  from_ref="HEAD~3"
tasuki feature main     → mode="range",   from_ref="feature", to_ref="main"
tasuki docs             → mode="docs"
tasuki docs design.md   → mode="docs",    doc_file="design.md"
```

### Tauri コマンド一覧 (`commands.rs`)

すべてのコマンドは `AppState`（リポジトリパスを保持する Mutex）を受け取り、`git.rs` のロジックに委譲する。

| コマンド | 引数 | 戻り値 | 用途 |
|---------|------|--------|------|
| `get_diff` | - | `DiffResult` | 未コミット変更（staged + working）を取得 |
| `get_staged_diff` | - | `DiffResult` | ステージ済み変更のみ取得 |
| `get_working_diff` | - | `DiffResult` | 未ステージ変更のみ取得 |
| `get_ref_diff` | `from_ref`, `to_ref` | `DiffResult` | 2 つの ref 間の差分を取得 |
| `get_commit_diff` | `commit_ref` | `DiffResult` | 特定コミットの差分（vs 親）を取得 |
| `get_log` | `max_count?` | `CommitInfo[]` | コミット履歴を取得 |
| `list_docs` | - | `string[]` | Markdown ドキュメント一覧を取得 |
| `read_file` | `file_path` | `string` | ファイル内容を読み取り |
| `start_watching` | - | `void` | ファイル監視を開始 |
| `get_repo_path` | - | `string` | リポジトリパスを取得 |
| `get_cli_args` | - | `CliArgs` | 起動時の CLI 引数を取得 |
| `get_repo_info` | - | `RepoInfo` | リポジトリ名・ブランチ名・worktree 状態を取得 |
| `get_head_sha` | - | `string` | HEAD コミットの SHA を取得 |
| `get_diff_hash` | `diff_result` | `string` | diff の SHA-256 ハッシュを計算（変更検知用） |
| `save_review` | `head_sha`, `source_type`, `json_data` | `void` | レビューセッションをディスクに保存 |
| `load_review` | `head_sha`, `source_type` | `string?` | 保存済みレビューセッションを読み込み |
| `list_design_docs` | - | `string[]` | `~/.claude/designs/{repo}/` 内の設計書一覧を取得 |
| `read_design_doc` | `filename` | `string` | 設計書の内容を読み取り（パストラバーサル検証付き） |
| `write_commit_gate` | `status`, `diff_hash`, `resolved_comments`, `resolved_doc_comments` | `void` | コミットゲートファイルを書き込み |
| `read_commit_gate` | - | `string?` | コミットゲートファイルを読み込み |
| `clear_commit_gate` | - | `void` | コミットゲートファイルを削除 |
| `spawn_terminal` | `cols`, `rows` | `void` | PTY ターミナルセッションを開始 |
| `write_terminal` | `data` | `void` | PTY にデータを書き込み |
| `resize_terminal` | `cols`, `rows` | `void` | PTY のサイズを変更 |
| `kill_terminal` | - | `void` | PTY セッションを終了 |
| `is_terminal_alive` | - | `boolean` | PTY セッションの生存確認 |

### Git 操作 (`git.rs`)

`git2-rs` を使い、シェルコマンドを一切呼ばずに Git 操作を行う。主要な差分取得関数：

- **`get_uncommitted_diff`** — HEAD と index の差分 + index と working tree の差分をマージ
- **`get_staged_diff`** — HEAD と index の差分
- **`get_working_diff`** — index と working tree の差分
- **`get_ref_diff`** — 任意の 2 つの tree 間の差分
- **`get_commit_diff`** — コミットとその親 tree 間の差分

`parse_diff` 関数で `git2::Diff` を独自の `DiffResult` 構造体にパースする。この過程で：
- ファイルごとの追加・削除行数をカウント
- hunk（変更ブロック）と行情報を抽出
- 自動生成ファイル（lock ファイル等）を検出しフラグを立てる
- 非バイナリファイルの旧・新コンテンツを取得

### ファイル監視 (`watcher.rs`)

`notify` crate と `notify-debouncer-mini` を組み合わせ、500ms のデバウンスでファイル変更を検知する。変更検知時に Tauri の `files-changed` イベントをフロントエンドへ emit する。

無視対象ディレクトリ: `.git/`, `node_modules/`, `target/`, `dist/`, `.tasuki/reviews/`, `__pycache__/`, `.next/`, `.nuxt/`

### エラーハンドリング (`error.rs`)

`TasukiError` 列挙型で Git・IO・Watch・引数エラーを統一的に扱う。`thiserror` で derive し、`Serialize` を手動実装することで Tauri IPC 経由でフロントエンドへ JSON として返せる。

```rust
pub enum TasukiError {
    Git(String),
    Io(String),
    Watch(String),
    InvalidArgument(String),
}
```

`git2::Error`、`std::io::Error`、`notify::Error` からの `From` 実装により、`?` 演算子でシームレスにエラー変換される。

### PTY 管理 (`pty.rs`)

`portable-pty` crate を使い、ターミナルタブで実際のシェルセッションを提供する。`PtyState` は Tauri のマネージド状態として保持され、`spawn_terminal` / `write_terminal` / `resize_terminal` / `kill_terminal` / `is_terminal_alive` コマンドから操作される。PTY からの出力は Tauri イベント (`terminal-output`) としてフロントエンドへ送信される。

## 4. フロントエンド設計 (React + TypeScript)

### コンポーネント階層

```
App
├── ErrorBoundary              # エラーバウンダリ：子コンポーネントのエラーをキャッチ
├── Toolbar                    # ヘッダー：表示モード切替、レイアウト切替、統計表示
├── DiffSearchBar              # Cmd/Ctrl+F で表示される diff 内検索バー
├── app-body
│   ├── FileSidebar            # サイドバー：ドキュメント一覧、変更ファイル一覧
│   └── MainContent            # メインエリア：表示モードに応じてコンテンツを切替
│       ├── [diff]  → DiffViewer（全画面）
│       └── [split] → 左ペイン(Docs/Terminal切替) + 右ペイン(DiffViewer)
└── ReviewPanel                # レビューパネル：コメント一覧、Copy All、判定ボタン
```

#### 追加コンポーネント

| コンポーネント | 役割 |
|--------------|------|
| `DiffSearchBar` | diff 内のテキスト検索 UI（Cmd/Ctrl+F でトグル） |
| `ErrorBoundary` | React エラーバウンダリ。未捕捉エラー時にフォールバック UI を表示 |
| `ResizablePane` | ドラッグで左右ペインの幅を変更できる分割コンテナ |
| `Terminal` | xterm.js ベースのターミナルエミュレータ。PTY と連携しリアルなシェル操作が可能 |

### 表示モード

アプリは 2 つの表示モードを持つ：

| モード | 説明 | ユースケース |
|--------|------|-------------|
| `diff` | 差分ビューアのみ全画面表示 | コード変更のレビューに集中 |
| `split` | 左ペイン(Docs/Terminal) + 右ペイン(Diff)（デフォルト） | 設計書を参照しながらレビュー、またはターミナルでClaude Codeを開いてdiffを見ながら調査 |

Split モードでは左ペインの内容を `Docs` / `Terminal` タブで切り替える（`leftPaneMode` で管理）。

差分ビューアは `split`（左右分割）と `unified`（統合表示）の 2 レイアウトに対応（Pierre の `diffStyle` と同一命名）。

### 状態管理 (`store/index.ts`)

Zustand による単一ストアで全アプリ状態を管理する。

```
TasukiState
├── 表示設定
│   ├── displayMode: "diff" | "split"
│   ├── leftPaneMode: "docs" | "terminal"
│   ├── diffLayout: "split" | "unified"
│   ├── diffOverflow: "scroll" | "wrap"           # 長い行の折り返し/横スクロール
│   ├── expandUnchanged: boolean                   # 未変更行の展開/折りたたみ
│   ├── tocOpen: boolean                           # 目次パネルの開閉
│   └── markdownViewMode: "preview" | "raw"        # Markdown 表示モード
│
├── 差分データ
│   ├── diffResult: DiffResult | null
│   └── diffSource: DiffSource（取得対象の指定）
│
├── ファイル選択
│   ├── selectedFile: string | null      # 選択中の差分ファイル
│   ├── selectedDoc: string | null       # 選択中のドキュメント
│   ├── docFiles: string[]               # ドキュメント一覧
│   ├── docContent: string | null        # ドキュメント内容
│   ├── collapsedFiles: Set<string>      # 折りたたみ中のファイル
│   ├── designDocs: string[]             # 設計書一覧（~/.claude/designs/）
│   └── docSource: "repo" | "design"     # ドキュメントソースの切替
│
├── Pierre diff 状態
│   ├── selectedLineRange: SelectedLineRange | null  # Pierre の行選択状態
│   ├── selectedLineFile: string | null              # 選択中のファイル
│   └── commentFormTarget: CommentFormTarget | null  # コメントフォーム対象
│
├── レビューコメント
│   ├── comments: ReviewComment[]        # コード行コメント
│   ├── docComments: DocComment[]        # ドキュメントセクションコメント
│   └── verdict: "approve" | "request_changes" | null
│
├── コミットゲート
│   └── gateStatus: "none" | "approved" | "rejected" | "invalidated"
│
├── レビュー永続化
│   └── reviewRestoreMode: "full" | "checklist" | "none"
│
└── ステータス
    ├── isLoading: boolean
    ├── error: string | null
    ├── repoPath: string
    └── repoInfo: RepoInfo | null        # リポジトリ名・ブランチ名
```

### カスタム Hooks

| Hook | 役割 |
|------|------|
| `useDiff` | `diffSource` の変更を監視し、対応する API を呼んで差分データを取得・ストアに保存 |
| `useFileWatcher` | Tauri の `files-changed` イベントをリッスンし、コールバックを実行 |
| `useReviewPersistence` | HEAD SHA + diff ハッシュに基づくレビューセッションの保存・復元。500ms デバウンスの自動保存 |

### Tauri API ブリッジ (`utils/tauri-api.ts`)

フロントエンドからバックエンドへの全呼び出しをこのモジュールに集約。`__TAURI__` グローバルの有無で Tauri 環境かどうかを判定し、非 Tauri 環境ではモックデータを返すフォールバックを提供する（ブラウザ単体での開発に対応）。

### イベントバス (`utils/tauri-events.ts`)

Tauri 環境とブラウザ環境で統一的なイベントバスを提供する。Tauri では `@tauri-apps/api/event` をラップし、ブラウザでは `EventTarget` ベースの実装を使用する。ファイル変更通知やターミナル出力などのイベント伝達に使用。

### ファイルアイコン (`utils/file-icons.tsx`)

ファイルの変更ステータス（added / deleted / modified / renamed）に応じた SVG アイコンを返すユーティリティ。FileSidebar で使用。

### レビュー出力フォーマット (`utils/format-review.ts`)

「Copy All」ボタン押下時に、全コメントを構造化テキストに変換する。

出力例：
```
## Review Result: Request Changes

### src/components/DiffViewer.tsx
- L42-L45
  > const handleClick = () => {
  >   setSelected(true);
  > };
  この処理はメモ化した方がよいのでは？

### docs/design.md
- アーキテクチャ: バックエンドの説明を追加してほしい

### Summary
Please address the above comments and request re-review.
```

## 5. データモデル

### 差分データ

Rust 側と TypeScript 側で同一構造の型を定義し、Tauri IPC の JSON シリアライズで透過的に変換される。

```
DiffResult
├── stats: DiffStats
│   ├── files_changed: number
│   ├── additions: number
│   └── deletions: number
└── files: FileDiff[]
    ├── file: DiffFile
    │   ├── path: string
    │   ├── old_path: string | null      # リネーム時のみ
    │   ├── status: "added" | "deleted" | "modified" | "renamed" | ...
    │   ├── additions: number
    │   ├── deletions: number
    │   ├── is_binary: boolean
    │   └── is_generated: boolean        # lock ファイル等
    ├── hunks: DiffHunk[]
    │   ├── header: string               # @@ -10,5 +12,8 @@
    │   ├── old_start / old_lines: number
    │   ├── new_start / new_lines: number
    │   └── lines: DiffLine[]
    │       ├── origin: "+" | "-" | " "
    │       ├── old_lineno / new_lineno: number | null
    │       └── content: string
    ├── old_content: string | null       # 変更前の全ファイル内容
    └── new_content: string | null       # 変更後の全ファイル内容
```

### レビューコメント

```
ReviewComment                          DocComment
├── id: string (UUID)                  ├── id: string (UUID)
├── file_path: string                  ├── file_path: string
├── line_start: number                 ├── section: string
├── line_end: number                   ├── body: string
├── code_snippet: string               ├── type: comment | suggestion | ...
├── body: string                       ├── created_at: number
├── type: comment | suggestion | ...   ├── author: "human" | "claude"
├── created_at: number                 ├── resolved: boolean
├── parent_id: string | null           ├── resolved_at: number | null
├── author: "human" | "claude"         └── resolution_memo: string | null
├── resolved: boolean
├── resolved_at: number | null
└── resolution_memo: string | null
```

### レビューセッション（永続化）

```
ReviewSession
├── head_commit: string             # HEAD コミット SHA
├── diff_hash: string               # diff の SHA-256 ハッシュ
├── diff_source: DiffSource         # 差分取得元の指定
├── created_at: number
├── updated_at: number
├── verdict: ReviewVerdict           # "approve" | "request_changes" | null
├── comments: ReviewComment[]
└── doc_comments: DocComment[]
```

### コミットゲート

```
CommitGateData
├── version: number                  # スキーマバージョン（現在: 2）
├── status: "approved" | "rejected"
├── timestamp: string                # RFC 3339
├── repository: string
├── branch: string
├── diff_hash: string                # diff ハッシュ（変更検知用）
├── resolved_comments: [...]         # 解決済みコードコメント
└── resolved_doc_comments: [...]     # 解決済みドキュメントコメント
```

ゲートファイルの保存先: `/tmp/tasuki/{repo}/{branch}/review.json`

### その他の型

| 型 | 説明 |
|----|------|
| `DiffSource` | 差分取得元の指定（uncommitted / staged / working / commit / range） |
| `DisplayMode` | 表示モード（diff / split） |
| `LeftPaneMode` | 左ペイン内容（docs / terminal） |
| `DiffLayout` | diff レイアウト（split / unified） |
| `ReviewVerdict` | レビュー判定（approve / request_changes / null） |
| `ReviewRestoreMode` | 復元モード（full: 完全復元 / checklist: チェックリスト / none） |
| `RepoInfo` | リポジトリ情報（repo_name, branch_name, is_worktree） |
| `GateStatus` | ゲート状態（none / approved / rejected / invalidated） |
| `CommitInfo` | コミット情報（id, short_id, message, author, time） |

## 6. データフロー

### 起動シーケンス

```
1. main.rs → lib::run()
2. CLI 引数パース → CliArgs 生成
3. Tauri Builder 初期化
   - プラグイン登録（clipboard, shell, dialog）
   - AppState（repo_path + watcher_handle）を Managed State に
   - PtyState を Managed State に
   - CliArgs を Managed State に
   - コマンドハンドラ登録
4. WebView 起動 → React アプリロード
5. App.tsx の useEffect:
   a. getRepoInfo() → repoInfo 設定（リポジトリ名、ブランチ名）
   b. getRepoPath() → repoPath 設定
   c. listDocs() → docFiles 設定、最初のドキュメントを選択
   d. listDesignDocs() → designDocs 設定
6. useDiff hook: diffSource に基づいて差分を取得
7. useFileWatcher: start_watching() でファイル監視開始
8. useReviewPersistence: HEAD SHA + diff ハッシュでセッション復元を試行
```

### レビューフロー

```
1. ユーザーがファイルを選択（FileSidebar）
   → setSelectedFile() → MainContent が対象ファイルの差分を描画

2. ユーザーが行番号をクリック/範囲選択（DiffViewer）
   → コメント入力フォーム表示

3. コメント投稿
   → addComment() → store に追加
   → ReviewPanel に反映、FileSidebar のバッジ更新

4. 判定ボタン押下（Approve / Request Changes）
   → setVerdict()

5. 「Copy All」ボタン押下
   → formatReviewPrompt() で構造化テキスト生成
   → copyToClipboard() でクリップボードにコピー
   → Claude Code にペーストしてフィードバック完了
```

### ファイル変更検知フロー

```
1. watcher.rs: ファイル変更を検知（500ms デバウンス）
2. 無視パターンにマッチしない変更をフィルタ
3. Tauri emit("files-changed", paths)
4. useFileWatcher hook がイベントを受信
5. useDiff の refetch() を呼び出し
6. 最新の差分データで UI を更新
```

## 7. ディレクトリ構造

```
tasuki/
├── docs/                          # ドキュメント
│   ├── ARCHITECTURE.md            # 本ドキュメント
│   ├── USAGE_EXAMPLES.md          # ユースケースサンプル集
│   ├── PIERRE_AUDIT.md            # Pierre 機能監査
│   ├── BEAUTIFUL_MERMAID_AUDIT.md # beautiful-mermaid 機能監査
│   ├── COMMIT_GATE_REVIEW_DESIGN.md      # コミットゲート設計書 v1
│   ├── COMMIT_GATE_REVIEW_DESIGN_V2.md   # コミットゲート設計書 v2
│   ├── REVIEW_PERSISTENCE_DESIGN.md      # レビュー永続化設計書
│   └── AI_WORKFLOW_OPTIMIZATION_DESIGN.md # AI 協業ワークフロー設計書
│
├── src/                           # フロントエンド（React + TypeScript）
│   ├── main.tsx                   # React エントリーポイント
│   ├── App.tsx                    # ルートコンポーネント
│   ├── components/
│   │   ├── Toolbar.tsx            # ヘッダーバー
│   │   ├── FileSidebar.tsx        # ファイル一覧サイドバー
│   │   ├── MainContent.tsx        # メインコンテンツ切替
│   │   ├── DiffViewer.tsx         # 差分表示
│   │   ├── DiffSearchBar.tsx      # diff 内検索バー
│   │   ├── MarkdownViewer.tsx     # Markdown 表示（TOC + Mermaid）
│   │   ├── ReviewPanel.tsx        # レビューコメント管理
│   │   ├── ResizablePane.tsx      # リサイズ可能な分割ペイン
│   │   ├── Terminal.tsx           # xterm.js ターミナルエミュレータ
│   │   └── ErrorBoundary.tsx      # エラーバウンダリ
│   ├── hooks/
│   │   ├── useDiff.ts             # 差分データ取得 hook
│   │   ├── useFileWatcher.ts      # ファイル変更監視 hook
│   │   └── useReviewPersistence.ts # レビュー永続化 hook
│   ├── store/
│   │   └── index.ts               # Zustand ストア
│   ├── types/
│   │   └── index.ts               # TypeScript 型定義
│   ├── utils/
│   │   ├── tauri-api.ts           # Tauri バックエンド API ブリッジ
│   │   ├── tauri-events.ts        # イベントバス（Tauri / ブラウザ統一）
│   │   ├── format-review.ts       # レビュー出力フォーマッタ
│   │   ├── diff-utils.ts          # 差分ユーティリティ
│   │   └── file-icons.tsx         # ファイル変更ステータスアイコン
│   ├── styles/
│   │   └── index.css              # グローバルスタイル
│   ├── __fixtures__/              # テスト用モックデータ
│   │   ├── mock-diff-data.ts
│   │   ├── mock-doc-data.ts
│   │   └── mock-repo-data.ts
│   └── __tests__/                 # ユニットテスト（Vitest）
│       ├── format-review.test.ts
│       └── store.test.ts
│
├── e2e/                           # E2E テスト（Playwright）
│   ├── playwright.config.ts
│   ├── fixtures/                  # E2E 用フィクスチャ
│   └── tests/
│       ├── ux1-diff-review.spec.ts
│       ├── ux2-line-comment.spec.ts
│       ├── ux3-copy-comment.spec.ts
│       ├── ux4-copy-all.spec.ts
│       └── ux5-docs-alongside.spec.ts
│
├── src-tauri/                     # バックエンド（Rust）
│   ├── Cargo.toml                 # Rust 依存関係
│   ├── build.rs                   # ビルドスクリプト
│   ├── tauri.conf.json            # Tauri 設定
│   ├── src/
│   │   ├── main.rs                # エントリーポイント
│   │   ├── lib.rs                 # CLI パース + アプリ初期化
│   │   ├── commands.rs            # Tauri コマンドハンドラ
│   │   ├── git.rs                 # Git 操作
│   │   ├── watcher.rs             # ファイル監視
│   │   ├── pty.rs                 # PTY（疑似端末）管理
│   │   └── error.rs               # エラー型
│   ├── tests/
│   │   └── git_integration.rs     # Git 統合テスト
│   └── capabilities/              # Tauri セキュリティ権限
│
├── index.html                     # HTML エントリーポイント
├── package.json                   # npm 依存関係
├── vite.config.ts                 # Vite 設定（Vitest 設定含む）
├── tsconfig.json                  # TypeScript 設定
└── eslint.config.js               # ESLint 設定
```
