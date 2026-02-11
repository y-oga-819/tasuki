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
さらに、コメントした行はまさに「変更すべき」と指摘した行であるため、修正後は code_snippet が一致しないのが通常のケースである。
つまりファジーマッチングはリレーワークフローでは原理的にほぼ失敗する。

### 対策：diff ハッシュによるモード分け

ファジーマッチングではなく、diff の内容が変わったかどうかで復元方式を切り替える。
保存時に diff 全体のハッシュを記録しておく。

| `head_commit` | `diff_hash` | 復元方式 |
|---------------|-------------|---------|
| 同じ | 同じ | **完全復元** — line_number でインライン表示 |
| 同じ | 違う | **チェックリスト表示** — ReviewPanel にのみ表示（インラインには出さない） |
| 違う | - | **新規セッション** — コメントを読み込まない |

- 「完全復元」は純粋な中断・再開のケース（diff が一切変わっていない）
- 「チェックリスト表示」はリレーワークフロー後のケース（コメントは修正確認用のチェックリストとして機能する）
- ReviewPanel のチェックリスト表示では「Outdated」バッジを付け、ユーザーが確認後に resolved にできる

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
}
```

### 永続化ファイル構造

```jsonc
// .tasuki/reviews/{head_sha}_{source_type}.json
{
  "head_commit": "abc1234def5678...",
  "diff_hash": "sha256_of_diff_content",
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

プロンプトに含めるのは、未解決スレッドごとに**人間の最後のコメント**とする。
スレッド全体を含めるとコンテキスト量が過大になるため、直近の人間の指摘に絞る。

```typescript
// 未解決のルートコメントを抽出
const unresolvedRoots = comments.filter(c => !c.resolved && !c.parent_id);

// 各スレッドから人間の最後のコメントを取得
const latestHumanComments = unresolvedRoots.map(root => {
  const humanReplies = comments
    .filter(c => c.parent_id === root.id && c.author === "human")
    .sort((a, b) => b.created_at - a.created_at);
  // リプライがあればその最新、なければルート自身
  return humanReplies[0] ?? root;
});

const prompt = formatReviewPrompt(latestHumanComments, docComments, verdict);
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

1. **Backend**: `get_head_sha` コマンドと diff ハッシュ生成を `git.rs` に追加
2. **Backend**: `save_review` / `load_review` コマンドを追加（`diff_hash` による復元モード判定を含む）
3. **Frontend**: `ReviewComment` 型に `parent_id`, `author`, `resolved`, `resolved_at` を追加
4. **Frontend**: `useReviewPersistence` hook を作成（保存・復元ロジック）
5. **Frontend**: `App.tsx` に hook を組み込み

### Phase 2: スレッド・解決状態

6. **Frontend**: コメント UI にリプライ表示・解決トグルを追加
7. **Frontend**: `format-review.ts` を拡張（未解決のみフィルタ）
8. **Frontend**: ReviewPanel に diff 変更時のチェックリスト表示を追加

### Phase 3: Claude Code 連携（未定）

Claude Code → Tasuki の書き戻し方式が決まり次第、具体的なタスクを定義する。

## 9. 既知の制約・注意点

| 項目 | 内容 |
|------|------|
| **ローカルのみ** | `.tasuki/` は `.gitignore` に入れるため、マシン間でレビュー状態は共有されない |
| **range diff のキー** | `{ type: "range", from, to }` の場合は `to` の SHA をキーに使用する |
| **amend** | `git commit --amend` で SHA が変わるため、旧レビューは orphaned になる（正しい動作） |
