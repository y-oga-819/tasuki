# Tasuki コミットゲート & レビュー連携 設計書

## 概要

Tasukiを開発フロー全体のコントロールプレーンとし、Claude Codeとのファイルベース連携によるコミットゲート機能を実装する。人間がTasuki上でコードレビューを行い、Approve/Rejectの結果をClaude Codeに伝達することで、レビューなしのコミットを防止する。

## 背景と課題

### 現状のワークフロー

1. Claude Codeで設計・実装を進める
2. 実装がひと段落した段階でTasukiを開いてレビュー
3. レビュー結果をプロンプトとしてコピーしClaude Codeに渡す

### 課題

- Claude Codeがレビューを待たずにコミットできてしまう
- レビュー結果のClaude Codeへの伝達が手動コピペに依存
- レビューコメントの優先度（即修正/次ステップで対応）を構造的に伝える手段がない

## Tasuki中心の開発フロー（目標）

```
設計skill起動 → 設計書初稿作成 → Tasukiで設計レビュー
→ context clear → タスク分解skill → context clear
→ 実装skill → Tasukiでコミット前レビュー → Approve/Reject
→ 全ステップ完了 → PR作成 → レビューskillでPRレビュー
→ 修正 → Approve → 人間がマージ
```

## Phase構成

### Phase 1: 現状（コピペ連携）

- Tasukiでレビュー → プロンプトをコピー → Claude Codeに貼り付け
- 既に実装済み

### Phase 2: ファイルベース連携（本設計の対象）

- Tasukiがレビュー結果をファイルに書き出す
- Claude CodeのPreToolUse Hookがコミット時にファイルを検査
- 承認なしのコミットをブロック

### Phase 3: MCP双方向連携（将来構想）

- TasukiがMCPサーバーとして動作
- Claude Codeがクライアントとしてリアルタイムにレビューコメント取得・返信
- PRレビューライクな体験をローカル開発で実現

## Phase 2 詳細設計

### レビュー結果ファイル仕様

#### ファイルパス

```
/tmp/tasuki/{repository_name}/review.json
```

#### ファイルフォーマット

```json
{
  "status": "approved" | "rejected",
  "timestamp": "2026-02-13T12:00:00Z",
  "repository": "tasuki",
  "branch": "feature/commit-gate",
  "resolved_comments": [
    {
      "file": "src/api/client.ts",
      "line": 42,
      "body": "変数名typo: retyr → retry",
      "resolution": "修正済み"
    }
  ]
}
```

#### 設計方針: コメントの解決モデル

- レビューコメントは「未解決（unresolved）」と「解決済み（resolved）」の2状態のみ
- **未解決コメントが1件でもある場合、Approveボタンは押せない（disabled）**
- コメントを解決するには、人間がUI上で明示的に「解決」操作を行う
- 解決済みコメントは `resolved_comments` としてreview.jsonに記録され、Claude Codeに参考情報として伝わる
- これにより priority の概念が不要になり、シンプルなフローとなる

### Claude Code Hook設計

#### settings.json

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

#### Hook スクリプト: tasuki-commit-gate.sh

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
REPO_NAME=$(basename "$(git rev-parse --show-toplevel 2>/dev/null)" 2>/dev/null)
if [ -z "$REPO_NAME" ]; then
  exit 0  # gitリポジトリ外では無視
fi

REVIEW_FILE="/tmp/tasuki/${REPO_NAME}/review.json"

# レビューファイルが存在しない → ブロック
if [ ! -f "$REVIEW_FILE" ]; then
  echo "❌ Tasukiでレビュー承認を得てからコミットしてください。"
  echo "   Tasukiを開いてコードレビューを実施し、Approve してください。"
  exit 2
fi

# ステータスを確認
STATUS=$(jq -r '.status // ""' "$REVIEW_FILE")

# rejected → ブロック
if [ "$STATUS" = "rejected" ]; then
  echo "❌ レビューがRejectされています。修正が必要です。"
  echo "   詳細: $REVIEW_FILE"
  exit 2
fi

# approved → 通過（未解決コメントはUI側で解決済みのため存在しない）
if [ "$STATUS" = "approved" ]; then
  # 解決済みコメントがあれば参考情報として表示
  RESOLVED_COUNT=$(jq '.resolved_comments | length' "$REVIEW_FILE" 2>/dev/null || echo "0")
  if [ "$RESOLVED_COUNT" -gt 0 ]; then
    echo "✅ レビュー承認済み（解決済みコメント ${RESOLVED_COUNT} 件）"
    echo ""
    jq -r '.resolved_comments[] | "  ✓ \(.file):\(.line) — \(.body)"' "$REVIEW_FILE"
    echo ""
  fi

  # 承認ファイルを消費（1回限り）
  rm -f "$REVIEW_FILE"
  exit 0
fi

# 不明なステータス → ブロック
echo "❌ レビューステータスが不明です: ${STATUS}"
exit 2
```

### Tasuki UI 設計

#### レビュー画面のApprove/Reject UI

```
┌─ コミット前レビュー ──────────────────────────────┐
│                                                    │
│  変更ファイル: 3 files changed                      │
│                                                    │
│  ┌─ src/api/client.ts ──────────────────────────┐  │
│  │  @@ -40,6 +40,10 @@                          │  │
│  │  + const retyr = 3;  // ← typo              │  │
│  │                                               │  │
│  │  💬 コメント:                                  │  │
│  │  ┌──────────────────────────────────────────┐ │  │
│  │  │ 変数名typo: retyr → retry               │ │  │
│  │  │                          [解決する ✓]     │ │  │
│  │  └──────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────┘  │
│                                                    │
│  ┌─ src/utils/helper.ts ─────────────────────────┐ │
│  │  @@ -10,3 +10,8 @@                            │ │
│  │  + // TODO: add error handling                 │ │
│  │                                                │ │
│  │  💬 コメント:                                   │ │
│  │  ┌──────────────────────────────────────────┐  │ │
│  │  │ ✓ 解決済み: エラーハンドリング追加したい   │  │ │
│  │  │    解決メモ: 次ステップで対応する          │  │ │
│  │  └──────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────┘ │
│                                                    │
│  未解決コメント: 1件                                │
│                                                    │
│  [Approve (disabled)]  [Reject]                    │
│   ↑ 未解決コメントがあるため押せない                 │
└────────────────────────────────────────────────────┘
```

#### ボタンの挙動

| ボタン | 条件 | review.json の status | 効果 |
|---|---|---|---|
| Approve | 未解決コメント 0件 | `approved` | コミット通過。解決済みコメントは参考情報として記録 |
| Approve | 未解決コメント 1件以上 | — | **ボタン disabled。押せない** |
| Reject | 常に押せる | `rejected` | コミットブロック |

#### コメントの解決フロー

1. レビュアー（人間）がコメントを追加 → 「未解決」状態
2. コードを修正 or 対応方針を決定した後、レビュアーが「解決する」ボタンを押す
3. 解決時に任意で「解決メモ」を入力できる（例: "修正済み"、"次ステップで対応"、"仕様通りなので問題なし"）
4. 全コメントが解決済みになると、Approveボタンが有効化される

### 処理フロー（コメントなしApprove）

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
    |                               |                          |
    |  再度 git commit 実行          |                          |
    |----→ Hook発火                  |                          |
    |  review.json あり & approved   |                          |
    |  review.json 削除              |                          |
    |  コミット成功 ✅                |                          |
```

### 処理フロー（コメントあり → 解決 → Approve）

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
    |                               |  ← Claude Codeに修正依頼  |
    |                               |    （プロンプトコピー等）   |
    |  コメント箇所を修正             |                          |
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
    |                               |                          |
    |  再度 git commit 実行          |                          |
    |----→ Hook発火                  |                          |
    |  approved & 解決済み2件を表示   |                          |
    |  review.json 削除              |                          |
    |  コミット成功 ✅                |                          |
```

## 実装スコープ

### Tasuki側

1. **レビュー画面にApprove/Reject UIを追加**
   - Approve / Reject ボタン（未解決コメントがあればApprove disabled）
   - コメント入力フォーム（ファイル・行番号・本文）
   - コメントの「解決する」ボタンと解決メモ入力
   - review.json の書き出し処理（Tauri fs API経由）

2. **レビュー状態の表示**
   - 現在のレビューステータス（未レビュー/承認済み/却下）をUI上に表示
   - 未解決コメントの残数表示（0件になるとApproveが有効化）

### Claude Code Hook側

3. **tasuki-commit-gate.sh の提供**
   - Hook スクリプトの作成
   - インストール手順のドキュメント

### 将来拡張（Phase 3）

4. **MCP連携**
   - TasukiをMCPサーバー化
   - `request_review` / `get_review_result` / `reply_to_comment` ツールの提供
   - レビューコメントへのリプライUI

## ファイル配置まとめ

| 用途 | パス |
|---|---|
| 設計書 | `~/.claude/design/{repo}/xxxx_{branch}.md` |
| タスク分解 | `~/.claude/design/{repo}/xxxx_{branch}-task.md` |
| レビュー結果（PR） | `~/.claude/reviews/{repo}/...` |
| コミットゲート | `/tmp/tasuki/{repo}/review.json` |
| Hook スクリプト | `~/.claude/hooks/tasuki-commit-gate.sh` |
