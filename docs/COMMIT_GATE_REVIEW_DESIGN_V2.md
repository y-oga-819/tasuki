# Tasuki コミットゲート & レビュー連携 設計書 v2

## 概要

Tasukiを開発フロー全体のコントロールプレーンとし、Claude Codeとのファイルベース連携によるコミットゲート機能を実装する。人間がTasuki上でコードレビューを行い、Approve/Rejectの結果をClaude Codeに伝達することで、レビューなしのコミットを防止する。

本設計書は初版（`COMMIT_GATE_REVIEW_DESIGN.md`）を、現在のコードベースの状態に合わせて改訂したものである。

## 初版からの変更点

| 項目 | 初版 | v2（本設計） | 理由 |
|------|------|-------------|------|
| ゲート状態の用語 | `approved` / `rejected` | `approved` / `rejected`（維持） | ストアの verdict（`approve` / `request_changes`）とは別概念として区別 |
| DocComment | 対象外 | ゲート判定に含める | 現在の型に `resolved` フィールドが既に存在 |
| ファイルI/O | Tauri fs API | Rust バックエンドコマンド | 現在のアーキテクチャ（全I/OがRustコマンド経由）に合わせる |
| 自動無効化 | なし | diff変更時にゲートファイルを自動削除 | Claude Code修正後の陳腐化を防止 |
| 解決メモ | `resolution` フィールド | `resolution_memo` フィールドを ReviewComment/DocComment に追加 | 既存型との整合性 |
| ゲートファイルの diff_hash | なし | 含める | Hook側でも陳腐化検知可能に |

## Phase構成（変更なし）

### Phase 1: 現状（コピペ連携） ← 実装済み
### Phase 2: ファイルベース連携 ← 本設計の対象
### Phase 3: MCP双方向連携 ← 将来構想

## Phase 2 詳細設計

### A. データモデルの変更

#### ReviewComment への追加フィールド

```typescript
export interface ReviewComment {
  // ... 既存フィールド ...
  resolved: boolean;          // ← 型は存在済み、UIが未実装
  resolved_at: number | null; // ← 型は存在済み、UIが未実装
  resolution_memo: string | null; // ← 新規追加
}
```

#### DocComment への追加フィールド

```typescript
export interface DocComment {
  // ... 既存フィールド ...
  resolved: boolean;          // ← 型は存在済み
  resolved_at: number | null; // ← 型は存在済み
  resolution_memo: string | null; // ← 新規追加
}
```

### B. ゲートファイル仕様

#### ファイルパス

```
/tmp/tasuki/{repository_name}/{branch_name}/review.json
```

ブランチ名に含まれる `/` はそのままディレクトリ区切りとして使用する（初版と同じ）。

#### ファイルフォーマット

```json
{
  "version": 2,
  "status": "approved",
  "timestamp": "2026-02-14T12:00:00Z",
  "repository": "tasuki",
  "branch": "claude/feature-branch-xxxx",
  "diff_hash": "a1b2c3d4e5f6...",
  "resolved_comments": [
    {
      "file": "src/api/client.ts",
      "line": 42,
      "body": "変数名typo: retyr → retry",
      "resolution_memo": "修正済み"
    }
  ],
  "resolved_doc_comments": [
    {
      "file": "docs/design.md",
      "section": "## API設計",
      "body": "エラーハンドリングの記述が不足",
      "resolution_memo": "次ステップで追記予定"
    }
  ]
}
```

初版との差分:
- `version` フィールドを追加（将来のフォーマット変更に対応）
- `diff_hash` を追加（Hook側での陳腐化検知用）
- `resolved_doc_comments` を追加

### C. Tauriコマンド設計

既存のアーキテクチャに合わせ、ゲートファイルの読み書きは Rust バックエンドコマンドとして実装する。

#### 新規コマンド一覧

| コマンド | 引数 | 戻り値 | 用途 |
|---------|------|--------|------|
| `write_commit_gate` | `status`, `diff_hash`, `resolved_comments`, `resolved_doc_comments` | `void` | ゲートファイルの書き出し |
| `read_commit_gate` | - | `CommitGateStatus \| null` | 現在のゲートファイルの読み取り |
| `clear_commit_gate` | - | `void` | ゲートファイルの削除 |

#### write_commit_gate の実装方針

```rust
#[tauri::command]
pub fn write_commit_gate(
    state: State<AppState>,
    status: String,        // "approved" or "rejected"
    diff_hash: String,
    resolved_comments: String,     // JSON string
    resolved_doc_comments: String, // JSON string
) -> Result<(), TasukiError> {
    let repo_path = state.repo_path.lock().unwrap().clone();
    let info = git::get_repo_info(&repo_path)?;

    let branch = info.branch_name
        .ok_or_else(|| TasukiError::Git("Not on a branch".to_string()))?;

    let gate_dir = PathBuf::from("/tmp/tasuki")
        .join(&info.repo_name)
        .join(&branch);

    fs::create_dir_all(&gate_dir)
        .map_err(|e| TasukiError::Io(format!("Cannot create gate dir: {}", e)))?;

    let gate_file = gate_dir.join("review.json");
    // ... JSON構築 & 書き出し ...
    Ok(())
}
```

### D. ゲートファイルの自動無効化

#### 課題

Approve後にClaude Codeがファイルを変更した場合、ゲートファイルのApproveが古い差分に対するものであり、無効化されるべきである。

#### 方針: 二重防御

1. **Tasuki側（フロントエンド）**: ファイル変更検知時にゲートファイルを削除し、verdictをリセット
2. **Hook側**: ゲートファイルの `diff_hash` と現在のdiffのハッシュを比較し、不一致なら拒否

#### Tasuki側の実装

既存の `useFileWatcher` hookがファイル変更を検知した際に、ゲートファイルが存在すれば削除する。

```typescript
// useFileWatcher の変更検知コールバック内
const onFilesChanged = useCallback(async () => {
  // 既存: diffの再取得
  await refetchDiff();

  // 新規: ゲートファイルがあれば無効化
  try {
    const gate = await api.readCommitGate();
    if (gate) {
      await api.clearCommitGate();
      setVerdict(null); // verdictもリセット
    }
  } catch {
    // 無視
  }
}, [refetchDiff, setVerdict]);
```

#### Hook側の実装（diff_hash検証）

```bash
# review.json の diff_hash と現在の diff のハッシュを比較
GATE_HASH=$(jq -r '.diff_hash // ""' "$REVIEW_FILE")
if [ -n "$GATE_HASH" ]; then
  CURRENT_HASH=$(git diff HEAD --stat | sha256sum | cut -d' ' -f1)
  if [ "$GATE_HASH" != "$CURRENT_HASH" ]; then
    echo "❌ レビュー承認後にコードが変更されています。再レビューしてください。"
    rm -f "$REVIEW_FILE"
    exit 2
  fi
fi
```

> **注意**: Hook側のハッシュ計算はTasuki側と同一のアルゴリズムである必要がある。Tasukiは `git2-rs` + `sha2` crate で計算しているため、Hook側ではそれと同等の計算が必要。実装時に具体的なアルゴリズムを合わせる。

### E. UI設計

#### コメント解決UI

ReviewPanelの各コメントに「解決」ボタンを追加する。

```
┌─ comment-item ─────────────────────────────┐
│ src/api/client.ts:L42                    ✕  │
│ ┌─ code-snippet ───────────────────────┐    │
│ │ const retyr = 3;                     │    │
│ └──────────────────────────────────────┘    │
│ 変数名typo: retyr → retry                   │
│                                             │
│ [解決する]                                   │
│  └→ 押下するとメモ入力欄が展開:              │
│     ┌──────────────────────────────┐        │
│     │ 修正済み                      │        │
│     └──────────────────────────────┘        │
│     [解決を確定]  [キャンセル]               │
└─────────────────────────────────────────────┘

↓ 解決後

┌─ comment-item resolved ────────────────────┐
│ ✓ src/api/client.ts:L42                 ↩  │
│ 変数名typo: retyr → retry                   │
│ 解決メモ: 修正済み                           │
└─────────────────────────────────────────────┘
```

- 解決済みコメントは視覚的にトーンダウン（opacity低下、取り消し線など）
- 「↩」ボタンで解決を取り消し可能
- 解決メモは任意（空でも解決可能）

#### Approve/Reject ボタンの改修

現在のverdictボタンを拡張し、ゲートファイル書き出しと連動させる。

```
┌─ review-verdict ────────────────────────────┐
│                                              │
│  未解決: 2件（コード: 1, ドキュメント: 1）      │
│                                              │
│  [Approve (disabled)]    [Reject]            │
│   ↑ 未解決コメントあり                        │
│                                              │
└──────────────────────────────────────────────┘

↓ 全コメント解決後

┌─ review-verdict ────────────────────────────┐
│                                              │
│  ✅ 全コメント解決済み（4件）                   │
│                                              │
│  [Approve]    [Reject]                       │
│                                              │
└──────────────────────────────────────────────┘
```

#### ボタンの挙動

| ボタン | 条件 | アクション |
|--------|------|-----------|
| **Approve** | 未解決コメント 0件 | ① `verdict` を `"approve"` に設定、② `write_commit_gate("approved", ...)` を呼び出し |
| **Approve** | 未解決コメント 1件以上 | **disabled** |
| **Reject** | 常に押せる | ① `verdict` を `"request_changes"` に設定、② `write_commit_gate("rejected", ...)` を呼び出し |

> **Note**: Reject時はCopy AllでフィードバックをコピーしてからClaude Codeに渡す既存フローも併用できる。ゲートファイルの `rejected` ステータスにより、Claude Codeがコミットしようとしてもブロックされるため、確実に人間のフィードバックが反映される。

#### ゲートステータス表示

Toolbarまたはレビューパネルに現在のゲートステータスを表示する。

```
[ゲート: 未レビュー]  ← review.json なし
[ゲート: ✅ 承認済み]  ← status: approved
[ゲート: ❌ 却下]     ← status: rejected
[ゲート: ⚠️ 無効]    ← diff変更により無効化された
```

### F. Claude Code Hook設計

#### settings.json（初版と同じ）

```jsonc
// ~/.claude/settings.json
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

#### Hook スクリプト: tasuki-commit-gate.sh（改訂版）

```bash
#!/bin/bash
# tasuki-commit-gate.sh
# Claude CodeのPreToolUse Hookとして動作し、
# Tasukiのレビュー承認なしのgit commitをブロックする

set -euo pipefail

# stdin からツール入力を読む
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""')

# git commit を含まないコマンドはそのまま通過
if ! echo "$COMMAND" | grep -qE 'git\s+commit'; then
  exit 0
fi

# リポジトリ名を取得
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
REPO_NAME=$(basename "$REPO_ROOT")

BRANCH_NAME=$(git rev-parse --abbrev-ref HEAD 2>/dev/null) || exit 0

REVIEW_FILE="/tmp/tasuki/${REPO_NAME}/${BRANCH_NAME}/review.json"

# レビューファイルが存在しない → ブロック
if [ ! -f "$REVIEW_FILE" ]; then
  echo "❌ Tasukiでレビュー承認を得てからコミットしてください。"
  echo "   Tasukiを開いてコードレビューを実施し、Approve してください。"
  exit 2
fi

# バージョンチェック
VERSION=$(jq -r '.version // 1' "$REVIEW_FILE")

# ステータスを確認
STATUS=$(jq -r '.status // ""' "$REVIEW_FILE")

# rejected → ブロック
if [ "$STATUS" = "rejected" ]; then
  echo "❌ レビューがRejectされています。修正してTasukiで再レビューしてください。"
  exit 2
fi

# approved → diff_hash検証 → 通過
if [ "$STATUS" = "approved" ]; then
  # v2: diff_hash検証（v1ではスキップ）
  if [ "$VERSION" -ge 2 ] 2>/dev/null; then
    GATE_HASH=$(jq -r '.diff_hash // ""' "$REVIEW_FILE")
    if [ -n "$GATE_HASH" ]; then
      # Tasukiと同一のハッシュ計算方法を使用する必要がある
      # TODO: 実装時に具体的なアルゴリズムを合わせる
      :
    fi
  fi

  # 解決済みコメントがあれば参考情報として表示
  RESOLVED_COUNT=$(jq '(.resolved_comments | length) + (.resolved_doc_comments | length)' "$REVIEW_FILE" 2>/dev/null || echo "0")
  if [ "$RESOLVED_COUNT" -gt 0 ]; then
    echo "✅ レビュー承認済み（解決済みコメント ${RESOLVED_COUNT} 件）"
    echo ""
    jq -r '.resolved_comments[]? | "  ✓ \(.file):\(.line) — \(.body)"' "$REVIEW_FILE"
    jq -r '.resolved_doc_comments[]? | "  ✓ \(.file) §\(.section) — \(.body)"' "$REVIEW_FILE"
    echo ""
  else
    echo "✅ レビュー承認済み（コメントなし）"
  fi

  # 承認ファイルを消費（1回限り）
  rm -f "$REVIEW_FILE"
  exit 0
fi

# 不明なステータス → ブロック
echo "❌ レビューステータスが不明です: ${STATUS}"
exit 2
```

### G. 処理フロー

#### フロー1: コメントなしApprove

```
[Claude Code]                    [Tasuki]                    [人間]
    |                               |                          |
    |  実装完了                      |                          |
    |  git commit 実行               |                          |
    |----→ Hook発火                  |                          |
    |  review.json なし → ブロック    |                          |
    |  「Tasukiでレビューしてください」 |                          |
    |                               |                          |
    |                               |  ← diff/変更を確認        |
    |                               |  ← 問題なし、Approve押下  |
    |                               |                          |
    |                               |  review.json 書き出し     |
    |                               |  (status: approved,       |
    |                               |   diff_hash: xxxxx)       |
    |                               |                          |
    |  再度 git commit 実行          |                          |
    |----→ Hook発火                  |                          |
    |  review.json あり & approved   |                          |
    |  review.json 削除              |                          |
    |  コミット成功 ✅                |                          |
```

#### フロー2: コメントあり → 解決 → Approve

```
[Claude Code]                    [Tasuki]                    [人間]
    |                               |                          |
    |  git commit 実行               |                          |
    |----→ Hook発火                  |                          |
    |  review.json なし → ブロック    |                          |
    |                               |                          |
    |                               |  ← コメント2件追加        |
    |                               |  (Approveボタン disabled) |
    |                               |                          |
    |                               |  ← "Reject" 押下         |
    |                               |  review.json 書き出し     |
    |                               |  (status: rejected)       |
    |                               |                          |
    |                               |  ← Copy All でフィードバック|
    |  ← Claude Codeに修正依頼       |    をペースト             |
    |  コメント箇所を修正             |                          |
    |                               |                          |
    |    ← ファイル変更検知           |                          |
    |    ← review.json 自動削除      |                          |
    |    ← verdict リセット          |                          |
    |                               |                          |
    |                               |  ← 修正を確認             |
    |                               |  ← コメント1を「解決」     |
    |                               |    解決メモ: "修正済み"    |
    |                               |  ← コメント2を「解決」     |
    |                               |    解決メモ: "次ステップ"  |
    |                               |                          |
    |                               |  未解決 0件 →              |
    |                               |  Approveボタン有効化!      |
    |                               |  ← Approve押下            |
    |                               |                          |
    |                               |  review.json 書き出し     |
    |                               |  (status: approved,       |
    |                               |   diff_hash: yyyyy,       |
    |                               |   resolved_comments: [...])│
    |                               |                          |
    |  再度 git commit 実行          |                          |
    |----→ Hook発火                  |                          |
    |  approved & 解決済み2件を表示   |                          |
    |  review.json 削除              |                          |
    |  コミット成功 ✅                |                          |
```

### H. Zustand Store の変更

```typescript
interface TasukiState {
  // ... 既存フィールド ...

  // コメント解決（新規）
  resolveComment: (id: string, memo: string | null) => void;
  unresolveComment: (id: string) => void;
  resolveDocComment: (id: string, memo: string | null) => void;
  unresolveDocComment: (id: string) => void;

  // ゲートステータス（新規）
  gateStatus: "none" | "approved" | "rejected" | "invalidated";
  setGateStatus: (status: "none" | "approved" | "rejected" | "invalidated") => void;
}
```

### I. レビューpersistenceとの関係

| 側面 | レビューpersistence | コミットゲート |
|------|-------------------|--------------|
| 目的 | レビューセッションの復元 | コミットの可否制御 |
| 保存場所 | `.tasuki/reviews/{sha}_{source}.json` | `/tmp/tasuki/{repo}/{branch}/review.json` |
| ライフサイクル | HEAD SHA と紐付き、明示的に削除しない | コミット成功時に消費（削除）、diff変更時に無効化 |
| 含むデータ | 全コメント、verdict、diff_hash | ステータス + 解決済みコメントのサマリーのみ |

これらは別の役割を持つため、独立したまま維持する。ゲートファイルはレビューpersistenceの「スナップショット」のような位置づけ。

## 実装スコープ

### ステップ1: コメント解決UI
1. `ReviewComment` / `DocComment` に `resolution_memo` フィールドを追加
2. ReviewPanel に「解決する」「解決取り消し」UIを追加
3. Zustand store に `resolveComment` / `unresolveComment` アクションを追加
4. 解決状態をレビューpersistenceに保存（既存の仕組みで自動的に保存される）

### ステップ2: Approve/Reject ゲート連動
1. Rust バックエンドに `write_commit_gate` / `read_commit_gate` / `clear_commit_gate` コマンドを追加
2. フロントエンドの tauri-api.ts にブリッジ関数を追加
3. Approve/Reject ボタンの改修（未解決コメント数に応じたdisabled制御、ゲートファイル書き出し）
4. ゲートステータスの表示UI

### ステップ3: 自動無効化
1. `useFileWatcher` のコールバックにゲートファイル削除ロジックを追加
2. verdict のリセット処理

### ステップ4: Hook スクリプト
1. `tasuki-commit-gate.sh` の作成
2. インストール手順のドキュメント
3. diff_hash 検証ロジックの実装（Tasuki側のハッシュ計算と合わせる）

## 検討事項・未決定事項

### 1. diff_hash の計算アルゴリズム統一

Tasuki は `git2-rs` + `sha2` crate で `compute_diff_hash()` を計算しているが、Hook スクリプト（bash）側で同一のハッシュを再現する必要がある。

**選択肢**:
- A: Tasuki側のハッシュ計算を `git diff` の出力ベースに変更し、bash側と統一
- B: Hook側の検証を省略し、Tasuki側の自動無効化のみに頼る
- C: Tasukiが補助CLIツール（`tasuki verify-gate` 等）を提供し、Hookから呼び出す

### 2. コメントなしレビューの扱い

コメントを1件も追加せずにApproveした場合、「本当にレビューしたのか」の確認が必要か？

**選択肢**:
- A: コメントなしでもApprove可能（現在の設計）
- B: 最低1件のコメント（承認コメント含む）を要求
- C: 確認ダイアログを表示

### 3. ゲート機能のON/OFF

全てのリポジトリでゲートが必要ではない。有効/無効の切り替えが必要か？

**選択肢**:
- A: Hook スクリプトのインストール有無で制御（Hookがなければゲートなし）
- B: Tasuki の設定ファイルで制御
- C: リポジトリに `.tasuki/config.json` を置いて制御

### 4. 複数コミットのワークフロー

一つのタスクで複数回コミットする場合、毎回レビューが必要か？

**選択肢**:
- A: 毎回レビュー必要（現在の設計、安全だが煩雑）
- B: タスク単位でApproveし、タスク完了まで有効
- C: 「このセッションでは自動承認」モードを追加

## ファイル配置まとめ

| 用途 | パス |
|------|------|
| 設計書 | `~/.claude/designs/{repo}/xxxx_{branch}.md` |
| タスク分解 | `~/.claude/designs/{repo}/xxxx_{branch}-task.md` |
| レビューpersistence | `.tasuki/reviews/{short_sha}_{source_type}.json` |
| コミットゲート | `/tmp/tasuki/{repo}/{branch}/review.json` |
| Hook スクリプト | `~/.claude/hooks/tasuki-commit-gate.sh` |
