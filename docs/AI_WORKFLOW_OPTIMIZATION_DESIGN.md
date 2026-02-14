# AI協業ワークフロー最適化 設計書 v2

> v1からの変更点: 実装コードの精査を踏まえ、「Tasukiに何を足すか」ではなく「プロトコルとして何を定義するか」に焦点を移した。Tasukiのコード変更は最小限に、最大のフロー改善を狙う。

---

## 1. 現状の正確な把握

### 1.1 Tasukiで今動くもの

コードベースを全ファイル精査した結果、**実装済み**の機能:

| 機能 | 実装箇所 | 状態 |
|------|----------|------|
| Diff表示（split/unified） | DiffViewer.tsx + Pierre | 安定動作 |
| 設計書Markdown表示 | MarkdownViewer.tsx | 安定動作 |
| Diff+Docs並列表示 | ResizablePane.tsx | 安定動作 |
| 行コメント追加/削除 | DiffViewer.tsx + ReviewPanel.tsx | 安定動作 |
| ドキュメントコメント | ReviewPanel.tsx | 安定動作 |
| Copy All（構造化エクスポート） | format-review.ts | 安定動作 |
| レビュー永続化 | useReviewPersistence.ts + commands.rs | 安定動作 |
| ファイル監視（500ms） | watcher.rs + useFileWatcher.ts | 安定動作 |
| ターミナル | Terminal.tsx + pty.rs | 安定動作 |
| 設計書読み込み（`~/.claude/designs/{repo}/`） | commands.rs | 安定動作 |
| CLI引数解析 | lib.rs | 安定動作 |
| コメントのverdict（approve/request_changes） | store/index.ts | 安定動作 |

### 1.2 型定義は存在するがUIがない機能

コード上にフィールドが定義されているが、UIに反映されていないもの:

| フィールド | 定義場所 | 想定用途 | UIでの扱い |
|-----------|----------|----------|-----------|
| `ReviewComment.resolved` | types/index.ts | コメント解決状態 | 保存はされるが表示・操作なし |
| `ReviewComment.resolved_at` | types/index.ts | 解決タイムスタンプ | 未使用 |
| `ReviewComment.parent_id` | types/index.ts | スレッド返信 | 未使用 |
| `ReviewComment.author` | types/index.ts | "human" \| "claude" | 保存はされるが表示なし |
| `ReviewComment.type` | types/index.ts | comment/suggestion/question/approval | 保存されるが視覚的区別なし |

### 1.3 存在しないもの

| カテゴリ | 状態 |
|---------|------|
| CLAUDE.md | なし |
| Skills定義 | なし |
| Git hooks / Claude Code hooks | なし |
| MCP server | なし |
| セッション管理 | なし |
| マルチエージェントレビュー | なし |
| コミットゲート | 設計書のみ（COMMIT_GATE_REVIEW_DESIGN.md） |

---

## 2. 根本的な問い直し

### 2.1 v1の問題点

v1では「Tasukiを開発セッションの状態マシンにする」と提案した。しかし実装を精査すると、これには以下の問題がある:

1. **オーバーエンジニアリング**: セッション管理UI、DCR管理UI、マルチエージェント統合UIなど、大量のUI開発を前提としている。Tasukiはレビューツールとして優れており、その役割を拡大しすぎるとフォーカスが失われる

2. **プロトコルとツールの混同**: フェーズ間の情報引き継ぎは「ツールの機能」ではなく「ファイルの規約」で解決できる。Tasukiにセッション管理をさせなくても、`~/.claude/designs/` にファイルを置くだけで機能する

3. **人間の行動変容が先**: ツールを作り込んでも、人間の使い方が変わらなければ効果は限定的

### 2.2 実際のボトルネックはどこか

ワークフローを分解して、各ステップのボトルネックを特定する:

```
(1) 設計skill起動        → ボトルネック: skillが未定義。何を出力すべきか毎回手探り
(2) 設計書初稿作成        → ボトルネック: なし（AIは高速）
(3) Tasukiで設計レビュー  → ボトルネック: 何を見るべきか不明確。Copy Allのフォーマットが設計向きでない
(4) context clear         → ボトルネック: 次のフェーズが前フェーズの文脈を受け取れない
(5) タスク分解            → ボトルネック: 分解の粒度と出力形式が不定
(6) context clear         → 同上
(7) 実装                  → ボトルネック: 設計書へのアクセス手段が暗黙的
(8) Tasukiでコードレビュー → ボトルネック: 設計書との照合が手動。コメント解決の仕組みがない
(9) commit                → ボトルネック: レビューなしでcommitできてしまう
(10) PR作成               → ボトルネック: なし
(11) context clear        → 同上
(12) PRレビュー           → ボトルネック: 設計経緯を知らない新コンテキストがレビュー
(13) 修正→Approve→マージ  → ボトルネック: なし
```

**集約すると、ボトルネックは3つ:**

1. **プロトコルの欠如**: 各skillの入出力が未定義で、フェーズ間の引き継ぎが人間の頭の中にしかない
2. **レビューの構造化不足**: 「何を見るべきか」「コメントが解決されたか」のサポートがない
3. **ゲートの欠如**: レビューなしでcommitできてしまう

### 2.3 パラダイムシフトの核心

**Tasukiを大きく変えるのではなく、Tasukiを中心としたプロトコルを定義する。**

```
            ┌───────────────────────────────────┐
            │         プロトコル層               │
            │  CLAUDE.md + Skills + Conventions  │
            └──────────┬────────────────────────┘
                       │ 定義する
        ┌──────────────┼──────────────────┐
        ▼              ▼                  ▼
   ┌─────────┐   ┌──────────┐     ┌───────────┐
   │Claude Code│   │  Tasuki   │     │ ファイル   │
   │(実行者)  │   │(検証者)  │     │(状態保持) │
   └─────────┘   └──────────┘     └───────────┘
        │              │                  │
        │  実装する     │  レビューする     │  引き継ぐ
        │              │                  │
        └──────────────┴──────────────────┘
              ワークフローが回る
```

- **Claude Code**: 各フェーズの作業を実行する。CLAUDE.mdに書かれたプロトコルに従う
- **Tasuki**: 成果物を検証する。設計書とdiffを並べ、構造化されたフィードバックを出す
- **ファイルシステム**: 状態を保持する。設計書、ハンドオフ、レビュー結果はすべてファイル
- **人間**: 判断する。AIの出力を選択・承認・修正する

---

## 3. プロトコルの定義

### 3.1 ファイル規約

すべてのフェーズ間連携をファイルで行う。新しいツール機能は不要。

```
~/.claude/designs/{repo_name}/     ← Tasukiが既に読める
├── {feature}/
│   ├── design.md                  ← 設計書本体
│   ├── decisions.md               ← 意思決定ログ（人間が読めるMarkdown）
│   └── steps.md                   ← タスク分解結果

.tasuki/reviews/                   ← Tasukiが既に読み書きする
├── {sha}_{source}.json            ← レビュー永続化（既存）

リポジトリルート/
├── CLAUDE.md                      ← プロトコル定義（新規作成）
```

**ポイント: 新しいディレクトリ構造は作らない。** `~/.claude/designs/{repo}/` はTasukiのcommands.rsが既にサポートしている。この既存パスに設計書・判断ログ・ステップ定義を置くだけでよい。

### 3.2 CLAUDE.mdの定義

CLAUDE.mdは、Claude Codeがプロジェクトの文脈とワークフローを理解するための最重要ファイル。

```markdown
# CLAUDE.md

## プロジェクト概要
（プロジェクト固有の情報）

## 開発ワークフロー

このプロジェクトでは、以下のフローで開発を行う。
各フェーズはskillとして定義されている。

### フェーズ1: 設計（/design skill）
- 入力: 人間の要求
- 出力: `~/.claude/designs/{repo}/{feature}/design.md`
- 出力: `~/.claude/designs/{repo}/{feature}/decisions.md`
- 完了条件: Tasukiで設計レビューがApproveされること

### フェーズ2: タスク分解（/decompose skill）
- 入力: design.md, decisions.md
- 出力: `~/.claude/designs/{repo}/{feature}/steps.md`
- 完了条件: Tasukiでレビューがされ、必要なら修正されること

### フェーズ3: 実装（/implement skill）
- 入力: design.md, decisions.md, steps.md の該当ステップ
- 出力: コード変更
- 制約: commitする前に必ずTasukiでレビューを受ける
- 制約: design.mdの仕様から逸脱する場合は、必ず人間に確認する

### フェーズ4: PRレビュー（/review-pr skill）
- 入力: PR差分 + design.md + decisions.md
- 出力: PRレビューコメント

## 設計書の規約

設計書は `~/.claude/designs/{repo名}/` に保存する。
Tasukiの「Design Docs」タブから閲覧・レビューできる。

### design.md のテンプレート
（以下にテンプレートを定義）

### decisions.md のフォーマット
判断に至った背景・代替案・棄却理由を記録する。
フォーマット:
  ## {判断事項}
  - 結論: {決定内容}
  - 理由: {なぜその選択か}
  - 代替案: {検討した他の選択肢とその棄却理由}
  - 決定者: human / ai（人間が追記）

### steps.md のフォーマット
  ## Step {N}: {タイトル}
  ### 概要
  ### 変更対象ファイル
  ### 受け入れ条件
  ### 依存関係
```

### 3.3 各Skillの定義

Claude Codeのskillは、CLAUDE.mdに記述された規約に基づくプロンプトパターン。

#### 設計skill

```
/design {feature名}

1. `~/.claude/designs/{repo}/{feature}/` ディレクトリを作成
2. 既存の設計書やアーキテクチャを参照
3. design.md を作成:
   - 目的とスコープ
   - 技術的アプローチ（選択肢がある場合は複数提示）
   - API / データモデル / 画面設計
   - エッジケース
   - テスト戦略
4. decisions.md を作成:
   - 主要な判断ポイントを列挙
   - 各判断について理由と代替案を記録
5. 完了メッセージ:
   「設計書を作成しました。Tasukiで `tasuki docs` を実行してレビューしてください」
```

#### タスク分解skill

```
/decompose {feature名}

1. `~/.claude/designs/{repo}/{feature}/design.md` を読む
2. `~/.claude/designs/{repo}/{feature}/decisions.md` を読む
3. steps.md を作成:
   - 意味のある実装単位に分解（1ステップ = 1 commit相当）
   - 各ステップに受け入れ条件を定義
   - ステップ間の依存関係を明記
4. 完了メッセージ:
   「タスク分解が完了しました。Tasukiでsteps.mdをレビューしてください」
```

#### 実装skill

```
/implement {feature名} step {N}

1. 以下を読んで文脈を取得:
   - `~/.claude/designs/{repo}/{feature}/design.md`
   - `~/.claude/designs/{repo}/{feature}/decisions.md`
   - `~/.claude/designs/{repo}/{feature}/steps.md` のStep N
2. Step Nの受け入れ条件に従って実装
3. 実装が完了したらcommitせずに停止
4. 完了メッセージ:
   「Step Nの実装が完了しました。Tasukiでレビューしてください:
    tasuki
    レビューがApproveされたらcommitします」
```

#### PRレビューskill

```
/review-pr {PR番号 or ブランチ}

1. PR差分を取得
2. 関連する設計書を読む:
   - `~/.claude/designs/{repo}/{feature}/design.md`
   - `~/.claude/designs/{repo}/{feature}/decisions.md`
3. 以下の観点でレビュー:
   - 設計書との一致
   - コード品質
   - テストの妥当性
   - セキュリティ
4. レビュー結果をPRコメントとして投稿
```

### 3.4 ハンドオフの実現方法

Context clear前の引き継ぎを、ファイルとCLAUDE.mdで実現する。

**重要な認識**: ハンドオフに専用のJSON形式は不要。design.md / decisions.md / steps.md が既にハンドオフドキュメントそのもの。

```
Context Clear前:
  AIが作成した成果物はファイルに永続化されている
  → design.md, decisions.md, steps.md

Context Clear後:
  新しいAIインスタンスが起動
  → CLAUDE.mdを読む（ワークフローと規約を理解）
  → skillが指定されたファイルを読む（前フェーズの文脈を取得）
  → 作業を開始
```

**v1との違い**: v1ではhandoff.jsonという専用ファイルを提案したが、実際には設計書・判断ログ・ステップ定義が直接ハンドオフの役割を果たす。人間が読めるMarkdownで書く方が、JSONより確認しやすく、Tasukiでそのまま表示できる。

---

## 4. Tasukiに必要な変更（最小限）

### 4.1 優先度1: コミットゲート（既存設計の実装）

COMMIT_GATE_REVIEW_DESIGN.md の通り実装する。ワークフロー改善で最大のインパクト。

**なぜ最優先か**: レビューを「お願い」から「強制」に変える唯一の手段。プロトコルをどれだけ定義しても、commitをブロックできなければAIはレビューをスキップする。

実装範囲:
- ReviewPanelにApprove/Rejectボタン追加（コメント全解決でApprove有効化）
- コメント解決UI（「解決する」ボタン + resolved状態の表示）
- `/tmp/tasuki/{repo}/{branch}/review.json` の書き出し
- `~/.claude/hooks/tasuki-commit-gate.sh` フック提供

### 4.2 優先度2: コメント解決UIの追加

`ReviewComment.resolved` フィールドは型定義に存在する。UIを追加するだけ。

```
現在のReviewPanel:
  src/auth/token.ts L42-45
  > const token = jwt.sign(payload, secret);
  expiresInが設定されていない
  [削除] [コピー]

変更後:
  src/auth/token.ts L42-45
  > const token = jwt.sign(payload, secret);
  expiresInが設定されていない
  [解決する] [削除] [コピー]

  解決済み:
  src/auth/token.ts L78               ← グレーアウト、折りたたみ可
  > return res.json({ token });
  httpOnly Cookieに設定する設計だった
  (解決済み 14:32)
```

変更箇所:
- `ReviewPanel.tsx`: 解決ボタン追加、解決済みコメントの表示切り替え
- `store/index.ts`: `resolveComment(id)` アクション追加
- `format-review.ts`: 未解決コメントのみをCopy Allに含める

### 4.3 優先度3: Copy Allの改善

現在の `formatReviewPrompt()` の出力を、skillとの連携に最適化する。

```
現在の出力:
  ## Review Result: Request Changes
  ### src/auth/token.ts
  - L42-L45
    > const token = jwt.sign(payload, secret);
    expiresInが設定されていない

改善後の出力:
  ## Review Result: Request Changes

  設計書: ~/.claude/designs/my-app/auth/design.md

  ### 未解決コメント

  #### src/auth/token.ts L42-L45
  ```typescript
  const token = jwt.sign(payload, secret);
  ```
  expiresInが設定されていない。design.md 3.2節では「有効期限1時間」と定義されている。

  ### 解決済みコメント (2件)
  （解決済みのため省略。必要に応じて再確認してください）

  ### 修正後の確認方法
  修正が完了したら、commitせずにTasukiでの再レビューを待ってください。
```

### 4.4 優先度4: 設計書との並列表示の改善

既存のDiff+Docsモードを活用する。現在は手動でドキュメントを選ぶ必要があるが、レビュー中の差分に関連する設計書を自動提案できるとよい。

変更箇所:
- `FileSidebar.tsx`: 変更ファイルのパスから関連設計書を推定し、上位に表示

実装方法:
- steps.md に `files_to_modify` を書く規約があるので、現在のステップに対応する設計書をハイライトする

### 4.5 やらないこと（v1から削除）

| v1の提案 | 削除理由 |
|---------|---------|
| セッション管理UI | ファイル規約で代替。UIを作り込む価値より、プロトコルの確立が先 |
| マルチエージェントレビュー統合UI | 統合ロジック（矛盾検出等）の設計が曖昧。まずは各エージェントのレビューを順番に確認すれば十分 |
| DCR管理UI | design.mdを直接編集 + decisions.mdに変更理由を追記する方がシンプル |
| セッションダッシュボード | 人間がフェーズを把握していれば不要。過度な可視化はノイズ |
| ハンドオフJSON | Markdown（design.md, decisions.md, steps.md）が直接ハンドオフの役割を果たす |
| フェーズ遷移自動化 | 人間の判断で遷移すべき。自動化は時期尚早 |

---

## 5. リデザインされたワークフロー

### 5.1 全体像

```
人間: やりたいことを入力
  │
  ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 1: 設計                                               │
│                                                             │
│ Claude Code:                                                │
│   /design {feature}                                         │
│   → design.md + decisions.md を生成                         │
│   → 「Tasukiでレビューしてください」と報告                     │
│                                                             │
│ 人間:                                                       │
│   tasuki docs                                               │
│   → design.mdを読む                                         │
│   → decisions.mdで判断ポイントを確認・追記                    │
│   → コメントを付ける（設計の問題点、質問、確認事項）           │
│   → Copy All → Claude Codeに貼り付け → 修正サイクル          │
│   → Approve                                                 │
│                                                             │
│ 並行してAIレビュー（任意）:                                   │
│   別ターミナルでClaude Code / Codexに design.md をレビュー依頼│
│   → 結果を人間が確認してTasukiのレビューに反映                │
│                                                             │
│ context clear                                               │
└─────────────────────────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 2: タスク分解                                          │
│                                                             │
│ Claude Code:                                                │
│   /decompose {feature}                                      │
│   → CLAUDE.mdを読み、design.md + decisions.md を読む         │
│   → steps.md を生成                                         │
│   → 「Tasukiでレビューしてください」と報告                     │
│                                                             │
│ 人間:                                                       │
│   tasuki docs                                               │
│   → steps.mdを読む（design.mdも並べて確認）                  │
│   → 粒度・順序・受け入れ条件を確認                            │
│   → 必要なら修正を依頼                                       │
│   → Approve                                                 │
│                                                             │
│ context clear                                               │
└─────────────────────────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 3: 実装（ステップごとにループ）                          │
│                                                             │
│ Claude Code:                                                │
│   /implement {feature} step {N}                             │
│   → CLAUDE.mdを読み、design.md + steps.md を読む             │
│   → Step Nを実装（commitしない）                             │
│   → 「Tasukiでレビューしてください」と報告                     │
│                                                             │
│ 人間:                                                       │
│   tasuki（Diff+Docsモード）                                  │
│   → 左: コード差分 / 右: design.md                           │
│   → 受け入れ条件と照合してレビュー                            │
│   → コメント → Copy All → Claude Codeで修正                  │
│   → 全コメント解決 → Approve                                │
│   → commitゲート解除 → Claude Codeがcommit                  │
│                                                             │
│ 設計問題を発見した場合:                                       │
│   → design.mdを直接修正                                      │
│   → decisions.mdに変更理由を追記                              │
│   → 影響するステップがあればsteps.mdも更新                    │
│                                                             │
│ 全ステップ完了まで繰り返し                                    │
└─────────────────────────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 4: PR作成                                              │
│                                                             │
│ Claude Code:                                                │
│   PR作成（design.md, decisions.mdへの参照をdescriptionに含む）│
│                                                             │
│ context clear                                               │
└─────────────────────────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 5: PRレビュー                                          │
│                                                             │
│ Claude Code:                                                │
│   /review-pr {PR番号}                                       │
│   → CLAUDE.mdを読み、design.md + decisions.md を読む         │
│   → PR全体を設計書と照合してレビュー                          │
│   → レビューコメントをPRに投稿                               │
│                                                             │
│ 人間:                                                       │
│   tasuki {base-branch} {feature-branch}                     │
│   → PR差分をTasukiで確認（design.mdと並べて）                │
│   → AIレビュー結果 + 自分の視点で最終確認                     │
│   → 修正が必要なら修正サイクル                                │
│   → Approve → マージ                                        │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Context Clearの前後で何が起きるか

```
Phase 1 完了時:
  ファイルに残っている:
    ~/.claude/designs/{repo}/{feature}/design.md    ← 設計書
    ~/.claude/designs/{repo}/{feature}/decisions.md ← 判断ログ
    .tasuki/reviews/{sha}_{source}.json             ← レビューコメント

  Claude Codeのコンテキスト:
    → clear

Phase 2 開始時:
  Claude Codeが読むもの:
    CLAUDE.md → 「/decompose は design.md と decisions.md を読む」
    design.md → 設計書の全文（レビュー反映済み）
    decisions.md → なぜそう設計したかの判断ログ

  失われるもの:
    レビュー中の会話の流れ → 重要な判断はdecisions.mdに記録済み
    設計の試行錯誤の過程 → design.mdの最終版があれば十分
```

**v1との違い**: v1では専用のhandoff.jsonを提案したが、実際にはdesign.md + decisions.mdが直接的かつ十分なハンドオフ。人間が読めるMarkdownの方がデバッグしやすく、Tasukiでそのまま表示できる。

### 5.3 AIレビューの並列実行（Tasuki変更なし）

マルチエージェントレビューはTasukiのUI統合なしで実現できる:

```
ターミナル1: Claude Code（設計を作成）
  → 設計完了を報告

ターミナル2: 別のClaude Codeインスタンス
  → 「~/.claude/designs/{repo}/{feature}/design.mdをレビューして。
     観点: 技術的妥当性、エッジケース、パフォーマンス」
  → レビュー結果をターミナルに出力

ターミナル3: Codex
  → 同じファイルを別の観点でレビュー

人間: Tasukiで design.md を開きつつ、各AIのレビュー結果を読む
  → 重要な指摘をTasukiのコメントとして追加
  → 矛盾する指摘は自分で判断
```

**Tasukiの統合UIなしでも、ファイルベースの規約があれば並列レビューは機能する。** 将来的に統合UIを作る場合は、各AIのレビュー結果を統一フォーマットのファイルに出力する規約を定めてから。

---

## 6. 人間の行動変容

### 6.1 設計フェーズでの変化

**Before**: 「認証機能を作って」→ AIが実装 → レビュー
**After**: 「認証機能の設計を作って。JWT vs セッションベースの比較も含めて」→ AIが設計書 → 人間が判断 → 設計書確定 → 実装へ

具体的な行動:
- **要求を具体化してから渡す**: 「○○を作って」ではなく「○○について、△△と□□の選択肢を比較した設計書を作って」
- **decisions.mdに自分の判断を記録する**: AIが提示した選択肢に対して、「△△を選択。理由: □□」と書く
- **「なぜ」を残す習慣をつける**: レビューで「ここ変えて」ではなく「ここ変えて。理由: 設計書の3.2節と矛盾している」

### 6.2 レビューフェーズでの変化

**Before**: 差分を全行読んで問題を探す
**After**: 設計書の受け入れ条件と照合して検証する

具体的な行動:
- **Diff+Docsモードを使う**: 右に設計書、左にdiff。設計書のセクションとコードの対応を確認
- **受け入れ条件をチェックリストとして使う**: steps.mdの各ステップの受け入れ条件を1つずつ確認
- **機械的チェックはAIに任せる**: typo、lint、フォーマット、型エラーはAIレビューに委任
- **コメント解決のサイクルを回す**: コメント→AI修正→Tasukiで確認→解決→次のコメント

### 6.3 context clear前の行動

**Before**: 何もせずclear
**After**: 判断の外部化を確認してからclear

```
clearする前のチェックリスト:
☐ design.mdに最新の設計が反映されている
☐ decisions.mdに重要な判断とその理由が記録されている
☐ steps.mdが必要な場合、最新の状態になっている
☐ 「次のフェーズのAIに伝えたいこと」がファイルに書かれている
```

---

## 7. 実装ロードマップ

### Wave 1: プロトコル確立（コード変更なし）

| # | タスク | 担当 | 成果物 |
|---|--------|------|--------|
| 1 | CLAUDE.mdの作成 | 人間 + AI | リポジトリルートのCLAUDE.md |
| 2 | 設計書テンプレートの作成 | 人間 + AI | CLAUDE.md内に記述 |
| 3 | decisions.mdフォーマットの確定 | 人間 | CLAUDE.md内に記述 |
| 4 | steps.mdフォーマットの確定 | 人間 | CLAUDE.md内に記述 |
| 5 | 各skillのプロンプトパターン定義 | 人間 + AI | CLAUDE.md内に記述 |

**効果**: コード変更ゼロで、ワークフローの「プロトコル欠如」を解消。すべてのフェーズが標準化されたファイルで接続される。

### Wave 2: コミットゲート + コメント解決

| # | タスク | 担当 | 変更ファイル |
|---|--------|------|-------------|
| 1 | コメント解決UI | 開発 | ReviewPanel.tsx, store/index.ts |
| 2 | 未解決コメントのApproveブロック | 開発 | ReviewPanel.tsx |
| 3 | review.json書き出し | 開発 | commands.rs |
| 4 | コミットゲートhookスクリプト | 開発 | 新規: tasuki-commit-gate.sh |
| 5 | Copy All改善（未解決のみ） | 開発 | format-review.ts |

**効果**: 「レビューなしcommit」を構造的に防止。レビューサイクルが完結する。

### Wave 3: レビュー体験の向上

| # | タスク | 担当 | 変更ファイル |
|---|--------|------|-------------|
| 1 | コメントauthorの表示 | 開発 | ReviewPanel.tsx, DiffViewer.tsx |
| 2 | コメントtypeの視覚化 | 開発 | ReviewPanel.tsx |
| 3 | 関連設計書の自動提案 | 開発 | FileSidebar.tsx |
| 4 | Mermaid図レンダリング | 開発 | MarkdownViewer.tsx |

**効果**: レビューの質が向上。設計書との照合が容易になる。

### 将来検討（必要性が明確になってから）

| 機能 | 前提条件 |
|------|---------|
| MCP双方向連携 | Copy Allの手動貼り付けが明確なボトルネックになった場合 |
| マルチエージェントレビュー統合UI | 並列レビューの頻度が高く、手動統合が負担になった場合 |
| セッション管理UI | 複数機能の同時開発でフェーズ管理が混乱した場合 |
| レビューパターン分析 | レビュー履歴が十分に蓄積された場合 |

---

## 8. v1 → v2 の変更サマリ

| 観点 | v1 | v2 |
|------|----|----|
| 核心 | Tasukiを状態マシンに | プロトコルを定義し、Tasukiは検証者に徹する |
| ハンドオフ | 専用JSON（handoff.json, decisions.json, session.json） | Markdown（design.md, decisions.md, steps.md） |
| セッション管理 | Tasuki UIに実装 | ファイル規約で代替（UIは作らない） |
| マルチエージェント | Tasukiで統合UI | 各AIが独立してレビュー、人間がTasukiで統合 |
| DCR | 専用フロー | design.md直接編集 + decisions.mdに理由追記 |
| 最優先実装 | セッション管理UI | コミットゲート + コメント解決UI |
| Tasukiの変更量 | 大（新画面・新コマンド多数） | 小（ReviewPanel拡張 + hook） |
| 即効性 | 低（大量のUI開発が先） | 高（Wave 1はコード変更ゼロ） |
