# レビューコメント永続化 設計書

> Tasuki のレビューコメントを永続化し、中断・再開、リレーワークフロー、コメント蓄積を実現するための設計。

## 1. 背景と課題

現状のコメントは Zustand のインメモリ状態のみに保持されており、アプリを閉じるとすべて失われる。
以下の 3 つのユースケースに対応するため、永続化が必要である。

### ユースケース

| # | シナリオ | 期待する動作 |
|---|---------|-------------|
| 1 | **中断・再開** — レビュー途中でアプリを閉じ、後で再開する | 前回のコメントが復元される |
| 2 | **リレーワークフロー** — Human がレビュー → Claude Code が修正 → Human が再確認 | Claude Code の返答がスレッドとして残り、未解決のみ再送信できる |
| 3 | **コメント蓄積** — コミット前に複数回レビューを重ねる | コメントが累積していく |

## 2. 基本方針：コミットハッシュベースの判定

### 原則

- **HEAD コミット SHA が同じ** → 前回のコメントをロードして続行
- **HEAD が変わった** → 新規セッション（古いファイルは残すが読み込まない）

### ユースケースとの適合性

| ユースケース | HEAD は変わった？ | 動作 |
|------------|----------------|------|
| 1: アプリを閉じて即再開 | 同じ | コメント復元 |
| 1: push/pull 後に再開 | 変わった | 前回は古いので破棄 OK |
| 2: AI が修正したがまだコミットしていない | 同じ | コメント復元（修正確認に使う） |
| 2: AI が修正してコミットまでした | 変わった | 新しい diff で新レビュー |
| 3: 何度かレビューを重ねる（コミット前） | 同じ | コメントが累積 |
| 3: コミットして次の作業へ | 変わった | 新レビューセッション |

### 前提条件

- 「コミットは Tasuki で確認してから」というフローを推奨する。これにより、Claude Code が修正してもコミットしない限り HEAD は変わらず、コメントの整合性が保たれる。

## 3. DiffSource スコープ

同じ HEAD に対して複数の DiffSource（`uncommitted`, `staged`, `commit`, `range`）が存在しうる。
staged 上のコメントと uncommitted 上のコメントは別物であるため、ファイル名に source type を含めてスコープを分離する。

```
.tasuki/reviews/{head_sha}_{source_type}.json
```

例：
```
.tasuki/reviews/abc1234_uncommitted.json
.tasuki/reviews/abc1234_staged.json
.tasuki/reviews/def5678_commit.json
```

## 4. ライン番号ズレへの対処

### 問題

HEAD が同じでもワーキングツリーが変われば diff が変わるため、コメントが指す行が移動・消滅しうる。

例：
1. Human が `L42` にコメント
2. Claude Code がファイルを修正（コミットなし）
3. Human が Tasuki 再開 → HEAD 同じ → コメント復元
4. しかし `L42` は別のコードになっている

### 対策：code_snippet によるファジーマッチング

1. コメント保存時に `code_snippet`（対象行の実際のコード）を記録する（既存の動作）
2. 復元時に、現在の diff から `code_snippet` を検索し、マッチする行にコメントを再配置する
3. マッチしない場合は `outdated` としてマークする

### outdated コメントの表示

- diff のインラインには表示しない（行番号が不正確なため）
- ReviewPanel に「Outdated」バッジ付きで表示する
- ユーザーは outdated コメントを確認し、解決済みにするか手動で再配置できる

## 5. データ構造

### ReviewComment の拡張

```typescript
export interface ReviewComment {
  // 既存フィールド
  id: string;
  file_path: string;
  line_start: number;
  line_end: number;
  code_snippet: string;
  body: string;
  type: "comment" | "suggestion" | "question" | "approval";
  created_at: number;

  // 新規フィールド
  parent_id: string | null;       // null ならルートコメント、値ありならリプライ
  author: "human" | "claude";     // 誰が書いたか
  resolved: boolean;              // 解決済みかどうか
  resolved_at: number | null;     // 解決した時刻
  outdated: boolean;              // ファジーマッチ失敗時に true
}
```

### 永続化ファイル構造

```jsonc
// .tasuki/reviews/{head_sha}_{source_type}.json
{
  "head_commit": "abc1234def5678...",
  "diff_source": { "type": "uncommitted" },
  "created_at": 1234567890000,
  "updated_at": 1234567891000,
  "verdict": "request_changes",
  "comments": [
    {
      "id": "uuid-1",
      "parent_id": null,
      "author": "human",
      "file_path": "src/main.ts",
      "line_start": 42,
      "line_end": 45,
      "code_snippet": "const x = useMemo(() => expensive(), [deps])",
      "body": "ここはメモ化すべき",
      "type": "suggestion",
      "resolved": false,
      "resolved_at": null,
      "outdated": false,
      "created_at": 1234567890000
    },
    {
      "id": "uuid-2",
      "parent_id": "uuid-1",
      "author": "claude",
      "file_path": "src/main.ts",
      "line_start": 42,
      "line_end": 45,
      "code_snippet": "",
      "body": "useMemo でラップしました",
      "type": "comment",
      "resolved": false,
      "resolved_at": null,
      "outdated": false,
      "created_at": 1234567891000
    }
  ],
  "doc_comments": [
    {
      "id": "uuid-3",
      "file_path": "docs/design.md",
      "section": "アーキテクチャ",
      "body": "バックエンドの説明を追加してほしい",
      "type": "comment",
      "author": "human",
      "resolved": false,
      "resolved_at": null,
      "created_at": 1234567890000
    }
  ]
}
```

### ディレクトリ構成

```
.tasuki/
└── reviews/
    ├── abc1234_uncommitted.json
    ├── abc1234_staged.json
    └── def5678_commit.json
```

- `.tasuki/` は `.gitignore` に追加する（ローカルレビュー状態は共有しない）
- `watcher.rs` では既に `.tasuki/reviews/` が無視対象になっている（無限ループ防止済み）

## 6. Claude Code ↔ Tasuki 連携

> **ステータス: 未定**
>
> Claude Code から Tasuki へのコメント書き戻し（リプライの追加等）の具体的な連携方式は未検討。
> Phase 1・2 の実装を進めた上で、実際のワークフローを踏まえて改めて設計する。
>
> 検討すべき論点：
> - 通信方式（ファイル直接書き込み / Tauri IPC / その他）
> - 排他制御の要否と方式
> - Claude Code 側が Tasuki のデータ構造をどこまで知る必要があるか

### Tasuki → Claude Code（確定済み）

未解決コメントからプロンプトを生成してクリップボードにコピーする方向は既存の「Copy All」の延長で実現可能。

```typescript
const unresolvedRoots = comments.filter(c => !c.resolved && !c.parent_id);
const prompt = formatReviewPrompt(unresolvedRoots, docComments, verdict);
```

### Claude Code → Tasuki（未定）

Claude Code が修正後にリプライコメントを Tasuki に返す方式は今後検討する。

## 7. ワークフロー全体像

```
┌─────────────────────────────────────────────────────────────┐
│  1. Human: Tasuki で diff を見てコメント追加                    │
│     → author: "human", resolved: false                      │
│     → .tasuki/reviews/{sha}_{source}.json に自動保存          │
├─────────────────────────────────────────────────────────────┤
│  2. Human: 「Claude Code に送信」ボタン                        │
│     → 未解決コメントのみからプロンプト生成                       │
│     → クリップボードにコピー or 直接送信                        │
├─────────────────────────────────────────────────────────────┤
│  3. Claude Code: プロンプトを受け取り修正                      │
│     → コードを修正（コミットはしない）                          │
│     → Tasuki への書き戻し方式は未定（将来検討）                 │
├─────────────────────────────────────────────────────────────┤
│  4. Human: Tasuki を再開                                      │
│     → HEAD 同じ → コメント復元                                │
│     → diff の変化を確認し、コメントを resolved にしていく       │
├─────────────────────────────────────────────────────────────┤
│  5. Human: 納得したら「resolved」にする                        │
│     → まだ未解決があればステップ 2 に戻る                       │
│     → 全て resolved ならコミット承認                           │
├─────────────────────────────────────────────────────────────┤
│  6. コミット → HEAD が変わる → 次のレビューセッションへ          │
└─────────────────────────────────────────────────────────────┘
```

## 8. 実装計画

### Phase 1: 基本的な永続化（中断・再開）

1. **Backend**: `get_head_sha` コマンドを `git.rs` に追加
2. **Backend**: `save_review` / `load_review` コマンドを追加
3. **Frontend**: `ReviewComment` 型に `parent_id`, `author`, `resolved`, `resolved_at`, `outdated` を追加
4. **Frontend**: `useReviewPersistence` hook を作成（保存・復元ロジック）
5. **Frontend**: `App.tsx` に hook を組み込み

### Phase 2: スレッド・解決状態

6. **Frontend**: コメント UI にリプライ表示・解決トグルを追加
7. **Frontend**: `format-review.ts` を拡張（未解決のみフィルタ）
8. **Frontend**: ReviewPanel に outdated コメントセクションを追加

### Phase 3: Claude Code 連携（未定）

Claude Code → Tasuki の書き戻し方式が決まり次第、具体的なタスクを定義する。

## 9. 既知の制約・注意点

| 項目 | 内容 |
|------|------|
| **ローカルのみ** | `.tasuki/` は `.gitignore` に入れるため、マシン間でレビュー状態は共有されない |
| **ファジーマッチの限界** | 同一コードが複数箇所にある場合、誤った行にマッチする可能性がある |
| **range diff のキー** | `{ type: "range", from, to }` の場合は `to` の SHA をキーに使用する |
| **amend** | `git commit --amend` で SHA が変わるため、旧レビューは orphaned になる（正しい動作） |
