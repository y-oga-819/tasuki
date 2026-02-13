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
  "status": "approved" | "approved_with_comments" | "rejected",
  "timestamp": "2026-02-13T12:00:00Z",
  "repository": "tasuki",
  "branch": "feature/commit-gate",
  "comments": [
    {
      "file": "src/api/client.ts",
      "line": 42,
      "body": "変数名にtypoがある",
      "priority": "must_fix"
    },
    {
      "file": "src/api/client.ts",
      "line": 80,
      "body": "次ステップでリトライロジックを追加したい",
      "priority": "next_step"
    }
  ]
}
```

#### コメント優先度（priority）

| 値 | 意味 | コミットへの影響 |
|---|---|---|
| `must_fix` | コミット前に修正必須 | ブロック |
| `should_fix` | できればコミット前に修正 | 通過（Claude Codeに判断を委ねる） |
| `next_step` | 次ステップで対応 | 通過 |
| `note` | 参考情報、対応不要 | 通過 |

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

# must_fix コメントがあるか確認
MUST_FIX_COUNT=$(jq '[.comments[] | select(.priority == "must_fix")] | length' "$REVIEW_FILE" 2>/dev/null || echo "0")

if [ "$MUST_FIX_COUNT" -gt 0 ]; then
  echo "❌ must_fix コメントが ${MUST_FIX_COUNT} 件あります。修正してからコミットしてください。"
  echo ""
  jq -r '.comments[] | select(.priority == "must_fix") | "  - \(.file):\(.line) — \(.body)"' "$REVIEW_FILE"
  echo ""
  echo "修正完了後、Tasukiで再度レビューしてください。"
  exit 2
fi

# approved または approved_with_comments（must_fixなし）→ 通過
if [ "$STATUS" = "approved" ] || [ "$STATUS" = "approved_with_comments" ]; then
  # should_fix / next_step / note コメントがあれば表示
  COMMENT_COUNT=$(jq '.comments | length' "$REVIEW_FILE" 2>/dev/null || echo "0")
  if [ "$COMMENT_COUNT" -gt 0 ]; then
    echo "✅ レビュー承認済み（コメント ${COMMENT_COUNT} 件あり）"
    echo ""
    jq -r '.comments[] | "  [\(.priority)] \(.file):\(.line) — \(.body)"' "$REVIEW_FILE"
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
│  │  💬 コメント追加:                              │  │
│  │  ┌──────────────────────────────────────────┐ │  │
│  │  │ 変数名typo: retyr → retry               │ │  │
│  │  │ 優先度: [Must Fix ▼]                     │ │  │
│  │  └──────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────┘  │
│                                                    │
│  ┌─ src/utils/helper.ts ─────────────────────────┐ │
│  │  @@ -10,3 +10,8 @@                            │ │
│  │  + // TODO: add error handling                 │ │
│  │                                                │ │
│  │  💬 コメント追加:                               │ │
│  │  ┌──────────────────────────────────────────┐  │ │
│  │  │ 次ステップでエラーハンドリング追加したい    │  │ │
│  │  │ 優先度: [Next Step ▼]                    │  │ │
│  │  └──────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────┘ │
│                                                    │
│  [Approve]  [Approve with Comments]  [Reject]      │
└────────────────────────────────────────────────────┘
```

#### ボタンの挙動

| ボタン | review.json の status | 効果 |
|---|---|---|
| Approve | `approved` | コメントなし。コミット即通過 |
| Approve with Comments | `approved_with_comments` | コメント付き。must_fixがあればブロック、なければ通過 |
| Reject | `rejected` | コミットブロック。却下理由をcommentsに記載 |

### 処理フロー

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
    |                               |  ← コメント入力           |
    |                               |  ← Approve押下           |
    |                               |                          |
    |                               |  review.json 書き出し     |
    |                               |                          |
    |  再度 git commit 実行          |                          |
    |----→ Hook発火                  |                          |
    |  review.json あり              |                          |
    |  must_fix なし → 通過          |                          |
    |  コメント表示                   |                          |
    |  review.json 削除              |                          |
    |  コミット成功                   |                          |
```

### must_fix がある場合のフロー

```
[Claude Code]                    [Tasuki]                    [人間]
    |                               |                          |
    |  git commit 実行               |                          |
    |----→ Hook発火                  |                          |
    |  review.json なし → ブロック    |                          |
    |                               |  ← Approve with Comments |
    |                               |  (must_fix コメントあり)  |
    |                               |  review.json 書き出し     |
    |                               |                          |
    |  再度 git commit 実行          |                          |
    |----→ Hook発火                  |                          |
    |  must_fix 2件 → ブロック       |                          |
    |  コメント内容を表示             |                          |
    |                               |                          |
    |  must_fix 箇所を修正           |                          |
    |                               |                          |
    |                               |  ← 修正を確認            |
    |                               |  ← must_fix を解消       |
    |                               |  ← 再Approve             |
    |                               |  review.json 更新        |
    |                               |                          |
    |  再度 git commit 実行          |                          |
    |----→ Hook発火                  |                          |
    |  must_fix なし → 通過          |                          |
    |  コミット成功                   |                          |
```

## 実装スコープ

### Tasuki側

1. **レビュー画面にApprove/Reject UIを追加**
   - Approve / Approve with Comments / Reject ボタン
   - コメント入力フォーム（ファイル・行番号・本文・優先度）
   - review.json の書き出し処理（Tauri fs API経由）

2. **レビュー状態の表示**
   - 現在のレビューステータス（未レビュー/承認済み/却下）をUI上に表示
   - must_fixコメントの残数表示

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
