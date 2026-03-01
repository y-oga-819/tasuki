# Rust バックエンド再設計 & UX改善 — 実装仕様書

## 概要

Tasuki の Rust バックエンド（`src-tauri/`）を再設計し、セキュリティ修正・UX改善・堅牢性向上・モジュール分割を実施する。

**スコープ:**
- セキュリティ修正（JSON手動構築の廃止、source_type バリデーション）
- UX改善（ファイル更新検知戦略の変更）
- 堅牢性向上（parking_lot::Mutex、PTY改善）
- 全コマンドの非同期化
- モジュール分割

---

## 1. モジュール構造

現在の `commands.rs`（525行）と `git.rs`（696行）をドメイン別に分離する。

### 1.1 新ファイル構成

```
src-tauri/src/
├── main.rs                 // エントリポイント（変更なし）
├── lib.rs                  // Tauriセットアップ + generate_handler
├── cli.rs                  // CLI引数パース（lib.rsから分離）
├── error.rs                // エラー型（Pty バリアント追加）
├── state.rs                // AppState 定義
├── git/
│   ├── mod.rs              // re-export
│   ├── diff.rs             // diff生成 + DiffParser構造体
│   ├── repo.rs             // Repository操作、info、log、head_sha
│   └── docs.rs             // list_doc_files, read_file
├── commands/
│   ├── mod.rs              // re-export
│   ├── diff.rs             // diff系コマンド + check_changes
│   ├── review.rs           // save_review, load_review
│   ├── gate.rs             // commit gate系（serde化）
│   ├── docs.rs             // docs系コマンド（バリデーション含む）
│   ├── editor.rs           // open_in_zed
│   └── terminal.rs         // PTY系コマンド
├── watcher.rs              // ファイル監視（変更なし）
└── pty.rs                  // PTY管理（child/reader_handle追加）
```

### 1.2 各モジュールの責務

#### `cli.rs`（lib.rs から分離）

```rust
#[derive(Debug, Clone, Serialize)]
pub struct CliArgs {
    pub mode: String,
    pub from_ref: Option<String>,
    pub to_ref: Option<String>,
    pub doc_file: Option<String>,
}

pub fn parse_cli_args(args: &[String]) -> CliArgs { ... }
```

既存の `lib.rs:37-97` のパース処理とテストをそのまま移動。

#### `state.rs`

```rust
use parking_lot::Mutex;
use crate::watcher::WatcherHandle;

pub struct AppState {
    pub repo_path: String,  // 不変値（Mutex不要）
    pub watcher_handle: Mutex<Option<WatcherHandle>>,
}
```

`repo_path` は起動時に一度設定されたら変わらないため `Mutex` を外す。
`watcher_handle` は `start_watching` で書き換えられるため `parking_lot::Mutex` で保護。

#### `git/diff.rs`

現在の `git.rs` から diff 関連の関数と型を移動:
- 型: `DiffFile`, `DiffHunk`, `DiffLine`, `FileDiff`, `DiffResult`, `DiffStats`
- 関数: `get_working_diff`, `get_staged_diff`, `get_uncommitted_diff`, `get_ref_diff`, `get_commit_diff`, `compute_diff_hash`
- 内部: `parse_diff`, `should_load_inline_contents`, `get_file_content_at_ref`, `read_working_file`, `is_generated_file`, `delta_to_status`
- 定数: `GENERATED_PATTERNS`, `MAX_INLINE_FILE_BYTES`

`parse_diff` 内の8個の可変変数を `DiffParser` 構造体にまとめる:

```rust
struct DiffParser {
    files: Vec<FileDiff>,
    path_to_idx: HashMap<String, usize>,
    current_file_idx: Option<usize>,
    current_hunk_header: String,
    current_hunk_old_start: u32,
    current_hunk_old_lines: u32,
    current_hunk_new_start: u32,
    current_hunk_new_lines: u32,
    current_lines: Vec<DiffLine>,
    additions_count: Vec<usize>,
    deletions_count: Vec<usize>,
}

impl DiffParser {
    fn new(files: Vec<FileDiff>) -> Self { ... }

    /// hunk/lineコールバックのエントリポイント
    fn handle_line(
        &mut self,
        delta: &git2::DiffDelta,
        hunk: Option<&git2::DiffHunk>,
        line: &git2::DiffLine,
    ) -> bool { ... }

    /// 蓄積中のhunkをファイルにフラッシュ
    fn flush_hunk(&mut self) { ... }

    /// パース完了、結果を返す
    fn finish(self, stats: git2::DiffStats) -> DiffResult { ... }
}
```

#### `git/repo.rs`

現在の `git.rs` からリポジトリ操作関連を移動:
- 型: `RepoInfo`, `CommitInfo`
- 関数: `open_repo`, `get_repo_info`, `get_head_sha`, `get_log`, `resolve_repo_name`

**`open_repo` の変更:** `Repository::discover()` → `Repository::open()`

```rust
pub fn open_repo(repo_path: &str) -> Result<Repository, TasukiError> {
    Ok(Repository::open(repo_path)?)
}
```

パスは起動時に確定しているため、毎回の上位ディレクトリ探索は不要。

#### `git/docs.rs`

現在の `git.rs` からドキュメント関連を移動:
- 関数: `list_doc_files`, `read_file`

#### `commands/diff.rs`

diff 系コマンド + 新規 `check_changes`:

```rust
#[tauri::command]
pub async fn get_diff(state: State<'_, AppState>) -> Result<DiffResult, TasukiError> {
    let repo_path = state.repo_path.clone();
    tokio::task::spawn_blocking(move || git::get_uncommitted_diff(&repo_path))
        .await
        .map_err(|e| TasukiError::Io(e.to_string()))?
}

// get_staged_diff, get_working_diff, get_ref_diff, get_commit_diff も同様のパターン

#[tauri::command]
pub async fn check_changes(state: State<'_, AppState>) -> Result<ChangeStatus, TasukiError> {
    let repo_path = state.repo_path.clone();
    tokio::task::spawn_blocking(move || {
        let repo = git::open_repo(&repo_path)?;
        let head_sha = repo.head()?.peel_to_commit()?.id().to_string();
        let has_changes = repo.statuses(None)?
            .iter()
            .any(|s| !s.status().is_empty());
        Ok(ChangeStatus { head_sha, has_changes })
    })
    .await
    .map_err(|e| TasukiError::Io(e.to_string()))?
}
```

```rust
#[derive(Debug, Clone, Serialize)]
pub struct ChangeStatus {
    pub head_sha: String,
    pub has_changes: bool,
}
```

#### `commands/review.rs`

`source_type` を enum 化してバリデーション:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SourceType {
    Uncommitted,
    Staged,
    Working,
    Commit,
    Range,
}

impl SourceType {
    fn as_str(&self) -> &'static str {
        match self {
            Self::Uncommitted => "uncommitted",
            Self::Staged => "staged",
            Self::Working => "working",
            Self::Commit => "commit",
            Self::Range => "range",
        }
    }
}

fn review_file_path(repo_path: &str, head_sha: &str, source_type: &SourceType) -> PathBuf {
    let short_sha = &head_sha[..head_sha.len().min(8)];
    PathBuf::from(repo_path)
        .join(".tasuki")
        .join("reviews")
        .join(format!("{}_{}.json", short_sha, source_type.as_str()))
}

#[tauri::command]
pub async fn save_review(
    state: State<'_, AppState>,
    head_sha: String,
    source_type: SourceType,  // serde が自動デシリアライズ
    json_data: String,
) -> Result<(), TasukiError> { ... }

#[tauri::command]
pub async fn load_review(
    state: State<'_, AppState>,
    head_sha: String,
    source_type: SourceType,
) -> Result<Option<String>, TasukiError> { ... }
```

#### `commands/gate.rs`

JSON 手動構築を serde 構造体に置き換え:

```rust
#[derive(Serialize)]
struct CommitGate {
    version: u32,
    status: String,
    timestamp: String,
    repository: String,
    branch: String,
    diff_hash: String,
    resolved_comments: serde_json::Value,
    resolved_doc_comments: serde_json::Value,
}

#[tauri::command]
pub async fn write_commit_gate(
    state: State<'_, AppState>,
    status: String,
    diff_hash: String,
    resolved_comments: String,
    resolved_doc_comments: String,
) -> Result<(), TasukiError> {
    let (repo_name, branch) = get_gate_context(&state)?;
    let path = gate_file_path(&repo_name, &branch);

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| TasukiError::Io(format!("Cannot create gate dir: {}", e)))?;
    }

    let gate = CommitGate {
        version: 2,
        status,
        timestamp: chrono::Utc::now().to_rfc3339(),
        repository: repo_name,
        branch,
        diff_hash,
        resolved_comments: serde_json::from_str(&resolved_comments)
            .unwrap_or(serde_json::Value::Array(vec![])),
        resolved_doc_comments: serde_json::from_str(&resolved_doc_comments)
            .unwrap_or(serde_json::Value::Array(vec![])),
    };

    let gate_json = serde_json::to_string(&gate)
        .map_err(|e| TasukiError::Io(format!("JSON serialize error: {}", e)))?;

    fs::write(&path, gate_json)
        .map_err(|e| TasukiError::Io(format!("Cannot write gate file: {}", e)))?;

    Ok(())
}
```

#### `commands/terminal.rs`

PTY 系コマンドのエラー型を `Result<_, String>` から `Result<_, TasukiError>` に統一:

```rust
#[tauri::command]
pub async fn spawn_terminal(
    app: AppHandle,
    state: State<'_, AppState>,
    pty_state: State<'_, PtyState>,
    cols: u16,
    rows: u16,
) -> Result<(), TasukiError> {
    let cwd = state.repo_path.clone();
    pty_state.spawn(&app, cols, rows, &cwd)?  // PtyState::spawn が TasukiError を返す
}
```

---

## 2. セキュリティ修正

### 2.1 JSON 手動構築の廃止

**対象:** `commands.rs:389-393` の `format!` マクロによる JSON 構築

**問題:** `status`、`repo_name`、`branch` にダブルクォートやバックスラッシュが含まれると不正な JSON が生成される。

**修正:** `CommitGate` 構造体 + `serde_json::to_string()` に置き換え（§1.2 commands/gate.rs 参照）。

### 2.2 `source_type` バリデーション

**対象:** `commands.rs` の `save_review` / `load_review`

**問題:** `source_type: String` をそのままファイルパスに使用。パストラバーサルの可能性。

**修正:** `SourceType` enum 化により、Tauri の serde デシリアライズ時に不正な値を拒否（§1.2 commands/review.rs 参照）。

---

## 3. UX改善: ファイル更新検知戦略

### 3.1 現在の問題

現在のフロー:
```
ファイル変更 → notify(500ms debounce) → "files-changed"イベント
→ フロントエンド(400ms debounce) → refetch()
→ setIsLoading(true) → get_diff() → setDiffResult() → 全再描画
```

問題点:
1. コメント入力中の diff 更新でコメントフォームが閉じる
2. ローディング画面の割り込みで読んでいた内容が消える
3. コミットゲートの意図せぬクリア

### 3.2 新戦略

| 条件 | 動作 | 理由 |
|------|------|------|
| HEAD SHA 変更 | **即時自動リフレッシュ** + コメント全クリア + ゲートクリア | コメント対象の差分コードはコミット済みのため、コメントの意味がない |
| 作業ツリー変更（同一HEAD）+ フォーカス中 | **通知バナー表示のみ**、ユーザーが手動更新 | レビュー中の割り込み防止 |
| 作業ツリー変更（同一HEAD）+ フォーカス復帰時 | **自動リフレッシュ** | Tasukiに戻った瞬間はレビュー未開始なので安全 |

### 3.3 Rust 側の変更

#### 3.3.1 `check_changes` コマンド（新規）

軽量な変更チェック用コマンド。diff 生成より遥かに軽い。

```rust
#[derive(Debug, Clone, Serialize)]
pub struct ChangeStatus {
    pub head_sha: String,
    pub has_changes: bool,
}

#[tauri::command]
pub async fn check_changes(state: State<'_, AppState>) -> Result<ChangeStatus, TasukiError> {
    let repo_path = state.repo_path.clone();
    tokio::task::spawn_blocking(move || {
        let repo = git::open_repo(&repo_path)?;
        let head_sha = repo.head()?.peel_to_commit()?.id().to_string();
        let has_changes = repo.statuses(None)?
            .iter()
            .any(|s| !s.status().is_empty());
        Ok(ChangeStatus { head_sha, has_changes })
    })
    .await
    .map_err(|e| TasukiError::Io(e.to_string()))?
}
```

#### 3.3.2 `window-focused` イベント（新規）

`lib.rs` のセットアップにウィンドウフォーカスイベントの発行を追加:

```rust
// lib.rs の run() 内、Tauri Builderセットアップ後
.setup(|app| {
    let main_window = app.get_webview_window("main")
        .expect("main window not found");
    let window_clone = main_window.clone();
    main_window.on_window_event(move |event| {
        if let tauri::WindowEvent::Focused(focused) = event {
            let _ = window_clone.emit("window-focus-changed", focused);
        }
    });
    Ok(())
})
```

### 3.4 フロントエンド側の変更

#### 3.4.1 diffStore に isStale 状態を追加

```typescript
// src/store/diffStore.ts に追加
isStale: boolean;
setIsStale: (stale: boolean) => void;
```

#### 3.4.2 tauri-api.ts に checkChanges を追加

```typescript
export interface ChangeStatus {
  head_sha: string;
  has_changes: boolean;
}

export async function checkChanges(): Promise<ChangeStatus> {
  return invoke<ChangeStatus>("check_changes");
}
```

mockInvoke にも追加:

```typescript
case "check_changes":
  return { head_sha: "mock_sha_1234", has_changes: false } as T;
```

#### 3.4.3 useFileWatcher の変更

現在の「即時 refetch」を「チェック + 条件分岐」に変更:

```typescript
export function useFileWatcher() {
  const { setIsStale } = useDiffStore();
  const headShaRef = useRef<string | null>(null);
  const windowFocusedRef = useRef(true);

  // HEAD SHA を初期取得して保持
  useEffect(() => {
    api.getHeadSha().then(sha => { headShaRef.current = sha; });
  }, []);

  // ウィンドウフォーカス追跡
  useEffect(() => {
    // Tauri: window-focus-changed イベント
    // ブラウザ: visibilitychange イベント
    const handleFocusChange = (focused: boolean) => {
      windowFocusedRef.current = focused;
    };
    // ... リスナー登録
  }, []);

  // files-changed イベントハンドラ
  useEffect(() => {
    const unlisten = eventBus.listen("files-changed", async () => {
      const status = await api.checkChanges();

      if (status.head_sha !== headShaRef.current) {
        // HEAD SHA 変更 → 即時リフレッシュ
        headShaRef.current = status.head_sha;
        onHeadChanged();  // refetch + コメントクリア + ゲートクリア
      } else if (status.has_changes) {
        // 作業ツリー変更
        if (!windowFocusedRef.current) {
          // フォーカスなし → stale フラグのみ（復帰時に自動リフレッシュ）
          setIsStale(true);
        } else {
          // フォーカスあり → 通知バナーのみ
          setIsStale(true);
        }
      }
    });
    return () => { unlisten(); };
  }, []);

  // フォーカス復帰時の自動リフレッシュ
  useEffect(() => {
    const handleFocusGain = () => {
      if (isStale) {
        refetch();
        setIsStale(false);
      }
    };
    // ... リスナー登録
  }, [isStale, refetch]);
}
```

#### 3.4.4 App.tsx の handleFilesChanged 変更

現在の `handleFilesChanged` は `useFileWatcher` 内部に統合されるため、App.tsx からは削除。

App.tsx は `useFileWatcher()` を呼ぶだけ（コールバック不要）。HEAD SHA 変更時の処理は useFileWatcher 内部で `reviewStore.clearAll()` 等を直接呼ぶ。

#### 3.4.5 通知バナー UI（新規コンポーネント）

`src/components/StaleBanner.tsx`:

```
┌────────────────────────────────────────────────────┐
│ ⚡ ファイルが更新されました   [差分を更新]  [✕]     │
└────────────────────────────────────────────────────┘
```

- `diffStore.isStale` が `true` の時に表示
- 「差分を更新」ボタンで `refetch()` + `setIsStale(false)`
- 「✕」ボタンで `setIsStale(false)`（バナーを閉じるだけ、次の変更で再表示）
- Toolbar の直下、LayoutSwitch の上に配置

---

## 4. 堅牢性向上

### 4.1 parking_lot::Mutex への移行

`Cargo.toml` に `parking_lot = "0.12"` を追加。

全モジュールで `std::sync::Mutex` → `parking_lot::Mutex` に置き換え:
- `.lock().unwrap()` → `.lock()`（parking_lot はpoison しないため unwrap 不要）
- AppState: `watcher_handle`（`repo_path` は Mutex 不要に）
- PtyState: `writer`, `master`, `child`(新規), `alive`

### 4.2 PTY 子プロセスハンドルの保持

`PtyState` に `child` フィールドを追加:

```rust
pub struct PtyState {
    writer: Mutex<Option<Box<dyn Write + Send>>>,
    master: Mutex<Option<Box<dyn portable_pty::MasterPty + Send>>>,
    child: Mutex<Option<Box<dyn portable_pty::Child + Send>>>,  // 追加
    reader_handle: Mutex<Option<JoinHandle<()>>>,                // 追加
    alive: Mutex<bool>,
}
```

`spawn()` で `_child` を保持:

```rust
let child = pair.slave.spawn_command(cmd)
    .map_err(|e| TasukiError::Pty(format!("Failed to spawn shell: {e}")))?;
drop(pair.slave);
*self.child.lock() = Some(child);
```

### 4.3 PTY リーダースレッドの追跡

`spawn()` で `JoinHandle` を保持:

```rust
let handle = std::thread::spawn(move || { ... });
*self.reader_handle.lock() = Some(handle);
```

`kill()` で join:

```rust
pub fn kill(&self) {
    *self.writer.lock() = None;
    *self.master.lock() = None;
    if let Some(mut child) = self.child.lock().take() {
        let _ = child.kill();
        let _ = child.wait();  // ゾンビ回避
    }
    if let Some(handle) = self.reader_handle.lock().take() {
        let _ = handle.join();
    }
    *self.alive.lock() = false;
}
```

### 4.4 PTY エラー型の統一

`error.rs` に `Pty` バリアント追加:

```rust
#[derive(Debug, thiserror::Error)]
pub enum TasukiError {
    #[error("Git error: {0}")]
    Git(String),
    #[error("IO error: {0}")]
    Io(String),
    #[error("Watch error: {0}")]
    Watch(String),
    #[error("Invalid argument: {0}")]
    InvalidArgument(String),
    #[error("PTY error: {0}")]
    Pty(String),  // 追加
}
```

PTY 系のすべての `Result<_, String>` を `Result<_, TasukiError>` に変更。

---

## 5. 全コマンドの非同期化

全 Tauri コマンドを `async` 化し、重い処理は `spawn_blocking` でオフロード。

### 5.1 パターン

```rust
// 重い処理（Git操作、ファイルI/O）
#[tauri::command]
pub async fn get_diff(state: State<'_, AppState>) -> Result<DiffResult, TasukiError> {
    let repo_path = state.repo_path.clone();
    tokio::task::spawn_blocking(move || git::get_uncommitted_diff(&repo_path))
        .await
        .map_err(|e| TasukiError::Io(e.to_string()))?
}

// 軽い処理（状態読み取りのみ）
#[tauri::command]
pub async fn get_repo_path(state: State<'_, AppState>) -> Result<String, TasukiError> {
    Ok(state.repo_path.clone())
}

// PTY 操作（同期で十分だが async シグネチャに統一）
#[tauri::command]
pub async fn is_terminal_alive(pty_state: State<'_, PtyState>) -> Result<bool, TasukiError> {
    Ok(pty_state.is_alive())
}
```

### 5.2 対象コマンド一覧

| コマンド | spawn_blocking | 理由 |
|---------|:-:|------|
| get_diff | ✓ | Git diff 生成 |
| get_staged_diff | ✓ | Git diff 生成 |
| get_working_diff | ✓ | Git diff 生成 |
| get_ref_diff | ✓ | Git diff 生成 |
| get_commit_diff | ✓ | Git diff 生成 |
| check_changes | ✓ | Git status チェック |
| get_log | ✓ | Git log 走査 |
| get_head_sha | ✓ | Git HEAD 読み取り |
| get_diff_hash | ✓ | SHA-256 計算 |
| get_repo_info | ✓ | Git repo 情報 |
| save_review | ✓ | ファイル I/O |
| load_review | ✓ | ファイル I/O |
| list_docs | ✓ | ディレクトリ走査 |
| read_file | ✓ | ファイル I/O |
| list_design_docs | ✓ | ディレクトリ走査 |
| read_design_doc | ✓ | ファイル I/O |
| list_dir_docs | ✓ | ディレクトリ走査 |
| read_external_file | ✓ | ファイル I/O |
| write_commit_gate | ✓ | ファイル I/O |
| read_commit_gate | ✓ | ファイル I/O |
| clear_commit_gate | ✓ | ファイル I/O |
| start_watching | - | Watcher起動（軽量） |
| get_repo_path | - | String clone のみ |
| get_cli_args | - | Clone のみ |
| open_in_zed | - | プロセス起動 |
| spawn_terminal | - | PtyState操作 |
| write_terminal | - | PtyState操作 |
| resize_terminal | - | PtyState操作 |
| kill_terminal | - | PtyState操作 |
| is_terminal_alive | - | bool 読み取り |

---

## 6. `lib.rs` の変更

### 6.1 generate_handler に check_changes を追加

```rust
.invoke_handler(tauri::generate_handler![
    // 既存のコマンド...
    commands::check_changes,  // 追加
])
```

### 6.2 setup でウィンドウフォーカスイベントを登録

```rust
.setup(|app| {
    let main_window = app.get_webview_window("main")
        .expect("main window not found");
    let window_clone = main_window.clone();
    main_window.on_window_event(move |event| {
        if let tauri::WindowEvent::Focused(focused) = event {
            let _ = window_clone.emit("window-focus-changed", focused);
        }
    });
    Ok(())
})
```

### 6.3 AppState の初期化変更

```rust
.manage(AppState {
    repo_path: repo_path,  // Mutex なし
    watcher_handle: parking_lot::Mutex::new(None),
})
```

---

## 7. Cargo.toml の変更

```toml
[dependencies]
# 追加
parking_lot = "0.12"

# 既存（変更なし）
# tokio は既に features = ["full"] で入っているため追加不要
```

---

## 8. 実装順序

### Phase 1: モジュール分割（機能変更なし）
1. `cli.rs` を `lib.rs` から分離
2. `state.rs` を `commands.rs` から分離
3. `git/` サブモジュール作成（diff.rs, repo.rs, docs.rs）
4. `commands/` サブモジュール作成（diff.rs, review.rs, gate.rs, docs.rs, editor.rs, terminal.rs）
5. `lib.rs` の import パスを更新
6. テスト通過を確認

### Phase 2: セキュリティ修正
7. `commands/gate.rs`: JSON 手動構築 → serde 構造体
8. `commands/review.rs`: `source_type: String` → `SourceType` enum

### Phase 3: 堅牢性向上
9. `Cargo.toml`: `parking_lot` 追加
10. 全モジュール: `std::sync::Mutex` → `parking_lot::Mutex`
11. `state.rs`: `repo_path` の Mutex 除去
12. `error.rs`: `Pty` バリアント追加
13. `pty.rs`: child ハンドル保持、reader_handle 追跡、エラー型統一
14. `git/diff.rs`: DiffParser 構造体化
15. `git/repo.rs`: `discover()` → `open()`

### Phase 4: 非同期化
16. 全コマンドを `async` 化 + `spawn_blocking`

### Phase 5: UX改善（Rust）
17. `commands/diff.rs`: `check_changes` コマンド追加
18. `lib.rs`: `window-focus-changed` イベント登録

### Phase 6: UX改善（フロントエンド）
19. `diffStore.ts`: `isStale` 状態追加
20. `tauri-api.ts`: `checkChanges` API 追加 + mock
21. `useFileWatcher.ts`: 通知 + 条件分岐ロジックに変更
22. `App.tsx`: `handleFilesChanged` を削除、`useFileWatcher()` に統合
23. `StaleBanner.tsx`: 通知バナーコンポーネント作成
24. LayoutSwitch またはメインレイアウトにバナー配置

---

## 9. テスト方針

### 自動テスト
- 既存の Vitest / Rust ユニットテストがすべて通ること
- `npm run lint` → `npm test` → `npm run build` がすべて通ること

### 手動確認
- CLAUDE.md の手動チェックリスト §1（diff表示）の項目
- CLAUDE.md の手動チェックリスト §2（行コメント）の項目
- ファイル変更時に通知バナーが表示されること
- HEAD SHA 変更時に即座にリフレッシュされること
- ウィンドウフォーカス復帰時に自動リフレッシュされること

---

## 10. 旧提案書との差分

| 項目 | 旧提案書 | 本仕様書 |
|------|---------|---------|
| 位置づけ | 提案ベース | 確定仕様 |
| モジュール分割 | 提案のみ | スコープ内 |
| 非同期化 | 提案のみ | スコープ内 |
| ウィンドウフォーカス | ハイブリッド案 | 自動リフレッシュに確定 |
| HEAD SHA 変更時 | 言及なし | 即時更新 + コメント全クリアに確定 |
| コメント保護ロジック | 行番号再マッピング案 | スコープ外（手動更新で対応） |
| Repository キャッシュ | Mutex<Repository> 案 | コマンドごとに open()（キャッシュなし） |
