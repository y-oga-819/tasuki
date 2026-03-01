# Rust バックエンド再設計 & UX改善提案

## 概要

Tasuki の Rust バックエンド（`src-tauri/`）を、現在提供しているUXを維持しつつゼロから再設計する場合の設計方針、現行実装の問題点、および UX 改善案をまとめる。

現行バックエンドは約 2,150 行・6 ファイルで構成され、Tauri v2 上で動作する。

```
src-tauri/src/
├── main.rs        (6行)   エントリポイント
├── lib.rs         (224行) CLI解析 + Tauriセットアップ
├── commands.rs    (524行) 24以上のコマンドハンドラ
├── git.rs         (695行) Git操作 + diff生成
├── watcher.rs     (222行) ファイル監視
├── pty.rs         (146行) ターミナルエミュレーション
└── error.rs       (45行)  エラー型定義
```

---

## 1. ゼロから再設計するなら

### 1.1 モジュール構造

現在の `commands.rs` は 24 以上のコマンドを 1 ファイルに持ち、diff・レビュー永続化・コミットゲート・ドキュメント・エディタ連携・PTY と無関係なドメインが混在している。ドメインごとに分離する。

```
src-tauri/src/
├── main.rs
├── lib.rs              // Tauriセットアップのみ
├── cli.rs              // CLI引数パース（lib.rsから分離）
├── error.rs            // エラー型（変更なし）
├── state.rs            // AppState定義 + リポジトリアクセサ
├── git/
│   ├── mod.rs          // re-export
│   ├── diff.rs         // diff生成（現git.rsの中核ロジック）
│   ├── repo.rs         // Repository操作、info、log、head_sha
│   └── docs.rs         // list_doc_files, read_file
├── commands/
│   ├── mod.rs          // re-export
│   ├── diff.rs         // diff系コマンド (get_diff, get_staged_diff, ...)
│   ├── review.rs       // save_review, load_review
│   ├── gate.rs         // commit gate系
│   ├── docs.rs         // list_docs, design_docs, external_docs
│   ├── editor.rs       // open_in_zed
│   └── terminal.rs     // spawn/write/resize/kill_terminal
├── watcher.rs          // ファイル監視
└── pty.rs              // PTY管理
```

**メリット:**
- 各コマンドグループが独立してテスト・変更できる
- 変更の影響範囲が明確になる
- コードレビュー時にドメイン単位でレビューできる

### 1.2 Repository の再利用

現在は**全コマンドで毎回** `Repository::discover()` を呼んでいる。`discover` はファイルシステムを上位に遡って `.git` を探索するため、パスが確定している状況では不要なオーバーヘッドがある。

```rust
// 現在: 毎回discoverで探索
pub fn open_repo(repo_path: &str) -> Result<Repository, TasukiError> {
    Ok(Repository::discover(repo_path)?)
}
```

**改善案:**

```rust
// 改善: パスが確定しているのでopenを使う
pub fn open_repo(repo_path: &str) -> Result<Repository, TasukiError> {
    Ok(Repository::open(repo_path)?)
}
```

さらに、`git2::Repository` のキャッシュも検討できるが、`Repository` は `!Send` のため Tauri の非同期コマンドとの相性に注意が必要。現実的には:

- `parking_lot::Mutex` で包んで同期コマンド内で使う
- もしくはコマンドごとに `Repository::open(path)` する（`discover` よりは軽い）

```rust
pub struct AppState {
    repo_path: String,                          // 不変なのでMutex不要（後述）
    repo: parking_lot::Mutex<Repository>,       // キャッシュする場合
    watcher_handle: parking_lot::Mutex<Option<WatcherHandle>>,
}

impl AppState {
    pub fn with_repo<F, T>(&self, f: F) -> Result<T, TasukiError>
    where
        F: FnOnce(&Repository) -> Result<T, TasukiError>,
    {
        let repo = self.repo.lock();
        f(&repo)
    }
}
```

### 1.3 `repo_path` の不変性

`repo_path` は起動時に一度設定されたら変わらない。にもかかわらず `Mutex<String>` で保護されている。

```rust
// 現在: 不変なのにMutex
pub repo_path: Mutex<String>,

// 改善: 不変値として保持（Tauri StateはArcでラップされるため共有可能）
pub repo_path: String,
```

### 1.4 非同期化

現在の全コマンドは同期関数。大きなリポジトリでの diff 生成はブロッキングになり得る。Tauri のコマンドスレッドプールで処理されるため致命的ではないが、`async` 化で Tauri ランタイムとの統合がより自然になる。

```rust
// 現在: 同期（Tauriのスレッドプールで実行される）
#[tauri::command]
pub fn get_diff(state: State<AppState>) -> Result<DiffResult, TasukiError> { ... }

// 改善: spawn_blockingで重い処理をオフロード
#[tauri::command]
pub async fn get_diff(state: State<'_, AppState>) -> Result<DiffResult, TasukiError> {
    let repo_path = state.repo_path.clone();
    tokio::task::spawn_blocking(move || {
        git::get_uncommitted_diff(&repo_path)
    })
    .await
    .map_err(|e| TasukiError::Io(e.to_string()))?
}
```

---

## 2. 現行実装の問題点（Rust ベストプラクティスとの乖離）

### 2.1 [高] JSON 手動構築によるインジェクション脆弱性

**場所:** `commands.rs:389-393`

```rust
let gate_json = format!(
    r#"{{"version":2,"status":"{}","timestamp":"{}","repository":"{}","branch":"{}","diff_hash":"{}","resolved_comments":{},"resolved_doc_comments":{}}}"#,
    status, timestamp, repo_name, branch, diff_hash,
    resolved_comments, resolved_doc_comments
);
```

`status`、`repo_name`、`branch` にダブルクォートやバックスラッシュが含まれると不正な JSON が生成される。ブランチ名に `"` を含むことは技術的に可能。

**改善:**

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

let gate = CommitGate {
    version: 2,
    status,
    timestamp: chrono::Utc::now().to_rfc3339(),
    repository: repo_name,
    branch,
    diff_hash,
    resolved_comments: serde_json::from_str(&resolved_comments)?,
    resolved_doc_comments: serde_json::from_str(&resolved_doc_comments)?,
};
let gate_json = serde_json::to_string(&gate)?;
```

### 2.2 [高] `source_type` のバリデーション不足

**場所:** `commands.rs` の `save_review` / `load_review`

`source_type: String` をそのままファイルパスに使っている。パストラバーサルの可能性がある。

```rust
fn review_file_path(repo_path: &str, head_sha: &str, source_type: &str) -> PathBuf {
    let short_sha = &head_sha[..head_sha.len().min(8)];
    // source_typeが "../../etc/passwd" だとパストラバーサル
    PathBuf::from(repo_path).join(".tasuki").join("reviews")
        .join(format!("{}_{}.json", short_sha, source_type))
}
```

design_doc 系では `validate_design_doc_filename` でバリデーションしているのに、review 系にはない。

**改善:**

```rust
// source_typeをenumにする
enum SourceType {
    Uncommitted,
    Staged,
    Working,
    Commit,
    Range,
}

// もしくは最低限の英数字バリデーション
fn validate_source_type(s: &str) -> Result<&str, TasukiError> {
    if s.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-') {
        Ok(s)
    } else {
        Err(TasukiError::InvalidArgument("Invalid source type".into()))
    }
}
```

### 2.3 [中] Mutex の `unwrap()` パニックリスク

全箇所で `.lock().unwrap()` を使用している（`commands.rs` に 19 箇所、`pty.rs` に 9 箇所）。

`std::sync::Mutex` はスレッドがパニック状態でロックを保持していると「poisoned」になり、次の `lock()` が `Err` を返す。`unwrap()` はその場合にパニックを伝播させる。

**改善:**

```rust
// parking_lot::Mutex を使う（poisonしない、APIも簡潔）
use parking_lot::Mutex;

// .lock() が直接 MutexGuard を返すため .unwrap() 不要
let repo_path = state.repo_path.lock().clone();
```

### 2.4 [中] PTY 子プロセスハンドルの破棄

**場所:** `pty.rs:58-62`

```rust
let _child = pair.slave.spawn_command(cmd)
    .map_err(|e| format!("Failed to spawn shell: {e}"))?;
drop(pair.slave);
```

`_child`（`Box<dyn Child>`）がスコープ終了で即座にドロップされる。これにより:
- 子プロセスを graceful に kill できない
- プロセスの終了コードを取得できない
- ゾンビプロセスのリスク（Unix で `wait()` されない場合）

**改善:**

```rust
pub struct PtyState {
    writer: Mutex<Option<Box<dyn Write + Send>>>,
    master: Mutex<Option<Box<dyn portable_pty::MasterPty + Send>>>,
    child: Mutex<Option<Box<dyn portable_pty::Child + Send>>>,  // 追加
    alive: Mutex<bool>,
}

pub fn kill(&self) {
    if let Some(mut child) = self.child.lock().take() {
        let _ = child.kill();
        let _ = child.wait();  // ゾンビ回避
    }
    // ...
}
```

### 2.5 [中] PTY リーダースレッドの未追跡

**場所:** `pty.rs:79`

```rust
std::thread::spawn(move || { ... });  // JoinHandleが捨てられている
```

- アプリ終了時にスレッドが自然消滅を待つしかない
- スレッドの異常終了を検知できない

**改善:** `JoinHandle` を `PtyState` に保持し、`kill()` 時に `join()` する。

### 2.6 [低] PTY のエラー型不統一

PTY 系コマンドは `Result<(), String>` を返すが、他のコマンドは `Result<T, TasukiError>` を使用している。

**改善:** `TasukiError` に `Pty(String)` バリアントを追加して統一する。

### 2.7 [低] `diff.print()` コールバック内の可変状態の散在

**場所:** `git.rs:298-383`

`diff.print()` のコールバック内で 8 個の可変変数が散在している。libgit2 の API 制約ではあるが、構造体にまとめると可読性が上がる。

```rust
struct DiffParser {
    files: Vec<FileDiff>,
    path_to_idx: HashMap<String, usize>,
    current_file_idx: Option<usize>,
    current_hunk: HunkBuilder,
    additions: Vec<usize>,
    deletions: Vec<usize>,
}

impl DiffParser {
    fn handle_line(&mut self, delta: &DiffDelta, hunk: Option<&DiffHunkHeader>, line: &DiffLineInfo) {
        // ...
    }
    fn finish(self) -> Vec<FileDiff> { ... }
}
```

---

## 3. UX 改善提案: ファイル更新検知とリフレッシュ戦略

### 3.1 現在の問題

現在のフローは「リアルタイムプッシュ型」:

```
ファイル変更 → notify (500ms debounce) → "files-changed" イベント
→ フロントエンド (400ms debounce) → refetch()
→ setIsLoading(true) → get_diff() → setDiffResult() → 全再描画
```

**Tasuki の実際の使用サイクル:**

```
Claude Code がコードを書く
  ↓
コミット前に Tasuki で人間がレビュー
  ↓
Claude Code がレビューをもとに修正
  ↓
再度 Tasuki でレビュー
  ↓
（繰り返し）
```

このサイクルにおいて、リアルタイム更新は以下の問題を引き起こす:

1. **コメント入力中の diff 更新** — 書きかけのコメントが対象行からずれる、またはコメントフォームが閉じる
2. **ローディング画面の割り込み** — `isLoading: true` で UI 全体がローディング状態になり、読んでいた内容が見えなくなる
3. **コミットゲートの意図せぬクリア** — `handleFilesChanged` で `clearCommitGate()` が呼ばれ、承認状態が失われる
4. **行番号のずれ** — hunk の構造が変わるとコメント対象の行番号がずれる

### 3.2 提案: 「通知 + 手動リフレッシュ」モデル

```
ファイル変更 → notify → "files-changed" イベント
→ フロントエンドが「stale」フラグをセット → 通知バッジ表示
→ ユーザーが「Refresh」ボタンを押す → refetch()
```

#### Rust 側の変更

軽量な変更チェック用コマンドを追加する。diff 生成より遥かに軽い。

```rust
#[derive(Serialize)]
pub struct ChangeStatus {
    pub head_sha: String,
    pub has_changes: bool,
}

/// 軽量な変更チェック（diff は生成しない）
#[tauri::command]
pub fn check_changes(state: State<AppState>) -> Result<ChangeStatus, TasukiError> {
    let repo_path = state.repo_path.lock().clone();
    let repo = Repository::open(&repo_path)?;

    let head_sha = repo.head()?.peel_to_commit()?.id().to_string();

    // statフラグだけ取得（diff生成より遥かに軽い）
    let has_changes = repo.statuses(None)?
        .iter()
        .any(|s| !s.status().is_empty());

    Ok(ChangeStatus { head_sha, has_changes })
}
```

#### フロントエンド側の変更

```typescript
// useFileWatcher を「通知のみ」に変更
export function useFileWatcher() {
  const [isStale, setIsStale] = useState(false);
  const [changeInfo, setChangeInfo] = useState<string | null>(null);

  useEffect(() => {
    const unlisten = eventBus.listen("files-changed", async () => {
      const status = await api.checkChanges();
      if (status.head_sha !== currentHeadSha) {
        setChangeInfo("新しいコミットが検出されました");
      } else if (status.has_changes) {
        setChangeInfo("ファイルが変更されました");
      }
      setIsStale(true);
    });
    return () => unlisten();
  }, []);

  return { isStale, changeInfo, clearStale: () => setIsStale(false) };
}
```

#### 通知 UI

```
┌──────────────────────────────────────────────────┐
│ ⚡ ファイルが更新されました   [差分を更新]  [✕]   │
└──────────────────────────────────────────────────┘
```

### 3.3 ハイブリッドアプローチ: ウィンドウフォーカス連動

Tauri ではウィンドウのフォーカスイベントを検知できる。Tasuki の使用サイクルに最も合致するのは以下の戦略:

| 状態 | 動作 |
|------|------|
| ウィンドウがフォーカスを失っている間のファイル変更 | フォーカス復帰時に**自動リフレッシュ** |
| ウィンドウがフォーカスされている間のファイル変更 | **通知バッジのみ**表示、手動更新 |

**理由:**
- Claude Code で作業中 → Tasuki はバックグラウンド → 変更は蓄積される
- Tasuki に切り替え → フォーカスイベントで最新 diff を一括取得（ユーザーはまだレビュー開始していないので安全）
- レビュー中に Claude Code が動いている → 通知のみ、レビュー作業を阻害しない

```rust
// Rust 側: ウィンドウフォーカスイベント
app.get_webview_window("main").unwrap()
    .on_window_event(|event| {
        if let tauri::WindowEvent::Focused(true) = event {
            let _ = app_handle.emit("window-focused", ());
        }
    });
```

```typescript
// フロントエンド側: フォーカス復帰時の自動リフレッシュ
useEffect(() => {
  const unlisten = listen("window-focused", () => {
    if (isStale) {
      refetch();
      setIsStale(false);
    }
  });
  return () => unlisten();
}, [isStale, refetch]);
```

### 3.4 コメント保護ロジック

手動リフレッシュ時にも、既存コメントの行番号がずれる可能性がある。更新時にコメントを再マッピングする処理を挟む。

```typescript
async function refreshWithCommentProtection() {
  const oldDiff = diffResult;
  const newDiff = await api.getDiff();

  // 既存コメントの行番号を新しい diff に再マッピング
  const updatedThreads = threads.map(thread => {
    const newFile = newDiff.files.find(f => f.file.path === thread.filePath);

    if (!newFile) {
      return { ...thread, orphaned: true }; // ファイルが diff から消えた
    }

    // hunk の差分から行番号のオフセットを計算
    const newLineNo = remapLineNumber(thread.lineNumber, oldFile, newFile);
    if (newLineNo === null) {
      return { ...thread, orphaned: true }; // 対象行が削除された
    }

    return { ...thread, lineNumber: newLineNo };
  });

  setDiffResult(newDiff);
  setThreads(updatedThreads);

  // orphaned コメントがある場合はユーザーに通知
  const orphaned = updatedThreads.filter(t => t.orphaned);
  if (orphaned.length > 0) {
    showWarning(`${orphaned.length} 件のコメントの対象行が変更されています`);
  }
}
```

---

## 4. 問題一覧と優先度

| # | カテゴリ | 問題 | 重要度 | 節 |
|---|---------|------|--------|-----|
| 1 | セキュリティ | JSON 手動構築でインジェクション可能 | **高** | 2.1 |
| 2 | セキュリティ | `source_type` のバリデーション不足 | **高** | 2.2 |
| 3 | UX | リアルタイム更新によるコメント破壊リスク | **高** | 3.1 |
| 4 | 堅牢性 | Mutex `unwrap()` パニックリスク | 中 | 2.3 |
| 5 | 堅牢性 | PTY 子プロセスハンドル破棄 | 中 | 2.4 |
| 6 | 設計 | 毎回 `Repository::discover()` | 中 | 1.2 |
| 7 | 堅牢性 | PTY リーダースレッド未追跡 | 低 | 2.5 |
| 8 | 一貫性 | PTY のエラー型が String | 低 | 2.6 |
| 9 | 設計 | `repo_path` が不変なのに Mutex | 低 | 1.3 |
| 10 | 設計 | `commands.rs` の肥大化 | 低 | 1.1 |
| 11 | 可読性 | `diff.print()` コールバック内の可変状態散在 | 低 | 2.7 |

---

## 5. 推奨実施順序

### Phase 1: セキュリティ修正（即時）
1. JSON 手動構築を serde に置き換え（#1）
2. `source_type` バリデーション追加（#2）

### Phase 2: UX 改善（短期）
3. ファイル更新戦略を「通知 + 手動リフレッシュ」に変更（#3）
4. ウィンドウフォーカス連動の自動リフレッシュ実装
5. コメント保護ロジックの実装

### Phase 3: 堅牢性向上（中期）
6. `parking_lot::Mutex` への移行（#4）
7. PTY 子プロセスハンドル保持（#5）
8. PTY リーダースレッド追跡（#7）
9. PTY エラー型統一（#8）

### Phase 4: 構造改善（長期）
10. `Repository::discover()` → `Repository::open()` 変更（#6）
11. `repo_path` の Mutex 除去（#9）
12. モジュール分割（#10）
13. diff パーサーの構造体化（#11）
