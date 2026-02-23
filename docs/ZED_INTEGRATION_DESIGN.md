# Zed エディタ連携設計書

> 作成日: 2026-02-23
>
> 目的: Tasuki から Zed を起動し、リポジトリを開く / Git 差分モードで開く機能を追加する。

## 1. 背景

Tasuki はレビュー「補助」ツールであり、コードの精密な読解は IDE に委譲するのが自然。
Zed はネイティブ Git 統合と高速な差分表示を備えており、Tasuki と補完関係にある。

## 2. Zed CLI の能力

### 2.1 基本コマンド

```bash
# ディレクトリを開く
zed /path/to/repo

# ファイルを特定行で開く
zed /path/to/file:42

# 2ファイルの diff を開く
zed --diff file1.txt file2.txt

# 待機モード（エディタが閉じるまでブロック）
zed --wait /path/to/file
```

### 2.2 Git 統合（エディタ内）

| 機能 | アクセス方法 |
|---|---|
| Project Diff | コマンドパレット → `git: diff all` |
| ファイル単位 diff | コマンドパレット → `git: diff` |
| Git Panel | サイドバーの Git タブ |
| Hunk 操作 | diff 内で stage/unstage/revert |

**制約**: `git: diff all` (Project Diff) は CLI から直接起動できない。
`zed` でリポジトリを開いた後、ユーザーがコマンドパレットで操作する必要がある。

### 2.3 Worktree サポート

- Zed は worktree ディレクトリを正しく認識する
- `zed /path/to/worktree` で開けば、そのworktreeのコンテキストで動作する
- 最近のバージョンで `git: diff` が active worktree を正しく参照するバグ修正済み

## 3. 設計

### 3.1 機能一覧

| # | 機能 | Zed CLI | 備考 |
|---|---|---|---|
| A | リポジトリを Zed で開く | `zed {repo_path}` | worktree でも repo_path がそのまま使える |
| B | 特定ファイルを Zed で開く | `zed {repo_path}/{file_path}` | サイドバーのファイル名から起動 |
| C | 特定ファイル+行で開く | `zed {repo_path}/{file_path}:{line}` | diff 内のコメント位置から起動 |

**Git 差分モードについて**: Zed の Project Diff は CLI から直接起動できないが、
`zed {repo_path}` でリポジトリを開けば、Zed 内で `Cmd+Shift+P → git: diff all` ですぐに差分モードに入れる。
Tasuki 側で「Zed で開いた後に diff モードを使ってね」というガイダンスを tooltip に含める程度が妥当。

### 3.2 アーキテクチャ

```
┌──────────────┐     Tauri command      ┌─────────────────┐
│  Frontend    │  ──────────────────►   │  Rust Backend   │
│  Toolbar.tsx │  open_in_zed(args)     │  commands.rs    │
│  Sidebar.tsx │                        │                 │
└──────────────┘                        │  std::process:: │
                                        │  Command::new   │
                                        │  ("zed")        │
                                        │  .args(...)     │
                                        │  .spawn()       │
                                        └─────────────────┘
```

`tauri_plugin_shell` の `shell:allow-open` は URL/ファイルの `open` 用であり、
任意のコマンド実行には使えない。`std::process::Command` で直接 spawn する。

### 3.3 Rust コマンド

```rust
// src-tauri/src/commands.rs

/// Open the repository (or a specific file) in Zed editor
#[tauri::command]
pub fn open_in_zed(
    state: State<AppState>,
    file_path: Option<String>,
    line: Option<u32>,
) -> Result<(), TasukiError> {
    let repo_path = state.repo_path.lock().unwrap().clone();

    let target = match (file_path, line) {
        (Some(fp), Some(ln)) => format!("{}:{}", Path::new(&repo_path).join(&fp).display(), ln),
        (Some(fp), None) => Path::new(&repo_path).join(&fp).display().to_string(),
        _ => repo_path,
    };

    std::process::Command::new("zed")
        .arg(&target)
        .spawn()
        .map_err(|e| TasukiError::Io(format!("Failed to launch Zed: {}", e)))?;

    Ok(())
}
```

### 3.4 TypeScript API

```typescript
// src/utils/tauri-api.ts

export async function openInZed(filePath?: string, line?: number): Promise<void> {
  return invoke<void>("open_in_zed", { filePath, line });
}
```

Mock:
```typescript
case "open_in_zed":
  console.log("[mock] Open in Zed:", args);
  return undefined as T;
```

### 3.5 UI 配置

#### A. ツールバー: リポジトリを開くボタン

```
toolbar-right:
  [...既存のボタン群...]  [Open in Zed]
```

- ツールバー右端に配置
- クリック → `openInZed()` (引数なし = リポジトリルート)
- tooltip: `"Open repository in Zed (⌘+Shift+Z)"`
- Tauri 環境外では非表示 (`isTauri` チェック)

#### B. サイドバー: ファイルを開くボタン

各ファイル名の右側に小さなアイコンボタン:

```
  src/main.rs  [↗]     ← hover 時に表示
  src/lib.rs   [↗]
```

- hover 時のみ表示（CSS `:hover` で制御）
- クリック → `openInZed(filePath)`

#### C. コメントから行ジャンプ（将来検討）

Review Panel 内のコメントに「Zed で開く」リンク:

```
  src/main.rs:L42  [📋] [↗]
```

- クリック → `openInZed(filePath, lineNumber)`

### 3.6 キーボードショートカット

| ショートカット | 動作 |
|---|---|
| `Cmd+Shift+Z` (Mac) / `Ctrl+Shift+Z` (other) | リポジトリを Zed で開く |

※ ファイル固有の操作はマウスのみ（サイドバーのアイコンクリック）

## 4. 実装ステップ

### Step 1: Rust コマンド追加
- `commands.rs` に `open_in_zed` を追加
- `lib.rs` の `invoke_handler` に登録
- ユニットテストは不要（外部プロセス起動のため）

### Step 2: TypeScript API 追加
- `tauri-api.ts` に `openInZed()` を追加
- `mockInvoke` にケース追加

### Step 3: ツールバーにボタン追加
- `Toolbar.tsx` の toolbar-right にボタン追加
- `isTauri` チェックで非表示制御
- キーボードショートカット登録

### Step 4: サイドバーにファイル単位のボタン追加
- `Sidebar.tsx` の各ファイル行に hover 表示のアイコンボタン追加

## 5. 注意事項

- `zed` コマンドがPATHにない環境ではエラーになる → エラーメッセージで「Zed がインストールされていません」と表示
- macOS では `zed` CLI は Zed.app 内のバイナリへのシンボリックリンク。未インストール時は `command not found`
- Linux では `zed` がフラットパック等で入っている場合、PATH 設定が必要な場合がある
- Zed がすでに起動中の場合、`zed /path` は既存ウィンドウにタブを追加する（新規ウィンドウは開かない）
