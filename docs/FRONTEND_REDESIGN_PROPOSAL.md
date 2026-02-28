# フロントエンド再設計提案

## 現状の課題サマリ

### Critical (設計に根本的な影響)

| # | 課題 | 現状 | 影響 |
|---|------|------|------|
| C1 | **全 DiffViewer が全コメント変更で再描画** | `comments` 配列を全ファイルの DiffViewer が購読。1件の解決で50ファイル分が再計算 | 大規模diffで顕著なパフォーマンス劣化 |
| C2 | **ResolveMemoForm が全未解決コメントに同時表示** | ReviewPanel 内で `{!c.resolved && <ResolveMemoForm />}` が全件展開 | UIの圧倒的なクラッタ |
| C3 | **diffStore が5つの責務を兼務 (27フィールド)** | diff データ, ドキュメント管理, ファイル選択, 行選択, リポジトリ情報 | 変更影響範囲が広く、テスト困難 |
| C4 | **split-right が diff-only モードでも全マウント** | MarkdownViewer, ReviewPanel が display:none で描画され続ける | 不要なメモリ消費とイベントリスナー |

### High (UX上の大きな摩擦)

| # | 課題 | 現状 | 影響 |
|---|------|------|------|
| H1 | サイドバーに検索/フィルタなし | 100+ファイルをスクロールで探す | 大規模changeset で致命的 |
| H2 | サイドバーに仮想化なし | 全ツリーノードを一括DOM生成 | 初期描画の遅延 |
| H3 | キーボードナビゲーションの欠落 | フォーカスインジケータなし, ARIA属性不足 | アクセシビリティ障壁 |
| H4 | 右ペインタブが sticky でない | スクロールでタブが画面外に出る | タブ切替にスクロールバックが必要 |
| H5 | 解決フォームが click-outside で閉じない | Cancel/Escape のみ | ユーザーが「閉じ方がわからない」 |
| H6 | Cmd+F のコンテキスト競合 | diff検索と terminal 検索が競合 | terminal 内検索が到達不能になるケース |
| H7 | API呼び出しにタイムアウトなし | Tauri バックエンド停止時に永久ハング | アプリがフリーズして見える |

### Medium (改善すべき点)

| # | 課題 | 現状 |
|---|------|------|
| M1 | レスポンシブ対応なし (media query ゼロ) | 固定px, モバイル完全非対応 |
| M2 | CSS が 1ファイル 2000行 | スコープなし、名前衝突リスク |
| M3 | リサイズハンドルが 4px (タッチ不可) | 最低8px必要 |
| M4 | ローディング/エラー状態が貧弱 | `Loading...` テキストのみ、スケルトンなし |
| M5 | Terminal の色がCSS変数でなくJS内ハードコード | テーマ変更時に二箇所修正が必要 |
| M6 | `LeftPaneMode` が右ペインを制御 (命名矛盾) | コードの可読性低下 |
| M7 | 検索状態がファイル切替で消失 | diff内検索のワークフロー断絶 |

---

## 再設計の方針

### 設計原則

```
1. Fine-Grained Reactivity  — 変更が影響するコンポーネントだけが再描画される
2. Progressive Disclosure    — 必要なときに必要なものだけ表示する
3. Accessibility First       — キーボード・スクリーンリーダー対応を基盤に組み込む
4. Lazy Everything           — 使わないものは生成しない (Terminal, 右ペイン, 検索)
5. CSS Scoping               — CSS Modules でスタイルの衝突を根絶する
6. Derived > Stored          — 計算できるものは store に保存しない
```

---

## 1. Store 再設計

### 現状 → 提案

```
現状 (3 stores)                      提案 (5 stores)
┌─────────────────────┐              ┌──────────────────┐
│ diffStore (27項目)   │              │ diffStore (8項目) │  diff データに集中
│  - diff データ       │              │  diffResult      │
│  - ドキュメント管理  │──分離──→     │  diffSource      │
│  - ファイル選択      │              │  isLoading       │
│  - 行選択/コメント   │              │  error           │
│  - リポジトリ情報    │              │  repoPath        │
├─────────────────────┤              │  repoInfo        │
│ displayStore (7項目) │              │  selectedFile    │
├─────────────────────┤              │  collapsedFiles  │
│ reviewStore (8項目)  │              └──────────────────┘
└─────────────────────┘              ┌──────────────────┐
                                     │ docStore (8項目)  │  ドキュメント専用
                                     │  docFiles        │
                                     │  designDocs      │
                                     │  externalFolders │
                                     │  externalDocs    │
                                     │  selectedDoc     │
                                     │  docSource       │
                                     │  docContent      │
                                     │  isDocLoading    │
                                     └──────────────────┘
                                     ┌──────────────────┐
                                     │ uiStore (7項目)   │  旧 displayStore + 名前修正
                                     │  displayMode     │
                                     │  rightPaneMode   │  ← LeftPaneMode から改名
                                     │  diffLayout      │
                                     │  diffOverflow    │
                                     │  expandUnchanged │
                                     │  tocOpen         │
                                     │  mdViewMode      │
                                     └──────────────────┘
                                     ┌──────────────────┐
                                     │ reviewStore      │  スレッドモデルに変更
                                     │  threads         │  ← Map<fileId, Thread[]>
                                     │  docComments     │
                                     │  verdict         │
                                     │  gateStatus      │
                                     └──────────────────┘
                                     ┌──────────────────┐
                                     │ editorStore      │  diff内インタラクション専用
                                     │  lineSelection   │  { range, file } を1つのオブジェクトに
                                     │  commentForm     │  commentFormTarget
                                     │  searchQuery     │  diff検索状態 (維持される)
                                     │  searchMatches   │
                                     └──────────────────┘
```

### コメントのスレッドモデル + ファイル正規化 (C1, C2 解決)

```typescript
// ── データ型 ──

// 親コメント・返信コメントの共通型
interface ReviewComment {
  id: string;
  file_path: string;
  line_start: number;
  line_end: number;
  code_snippet: string;
  body: string;
  type: "comment" | "suggestion" | "question" | "approval";
  created_at: number;
  author: "human" | "claude";
}

// スレッド = 親コメント + 返信 + 解決状態
interface ReviewThread {
  root: ReviewComment;           // 親コメント (1つ)
  replies: ReviewComment[];      // 返信 (0〜N件, フラット, 孫なし)
  resolved: boolean;             // 解決済みか (スレッド単位)
  resolved_at: number | null;
}

// ── Store ──

// 現状: 全コメントを1つの配列で管理
comments: ReviewComment[]

// 提案: ファイルパスでインデックス化した Map<string, ReviewThread[]>
threads: Map<string, ReviewThread[]>
// ├─ "src/App.tsx" → [thread1, thread2]
// └─ "src/store/diffStore.ts" → [thread3]

// DiffViewer は自分のファイルのスレッドだけを購読:
const fileThreads = useReviewStore(
  (s) => s.threads.get(filePath) ?? EMPTY_ARRAY
);
// → 他ファイルのコメント変更で再描画されない
```

**変更のポイント**:
- `parent_id` フィールドを廃止し、`ReviewThread` が構造的に親子関係を表現
- `resolution_memo` を廃止 (返信で代替)
- `resolved` は `ReviewThread` の属性 (個々のコメントではない)
- 孫コメント不可は型レベルで保証 (`replies` が `ReviewComment[]` であり、`ReviewThread[]` ではない)

### 行選択の統合 (editorStore)

```typescript
// 現状: 2つの独立したフィールド (不整合リスク)
selectedLineRange: SelectedLineRange | null;
selectedLineFile: string | null;

// 提案: 1つのオブジェクト (null は「選択なし」)
lineSelection: {
  file: string;
  range: SelectedLineRange;
} | null;
```

---

## 2. コンポーネントツリー再設計

### 現状の問題

```
MainContent
 ├─ [isViewer]  main.viewer-layout → ResizablePane
 ├─ [!isViewer] main → split-left + split-right (常にマウント)
 └─ Terminal (parkingRef, DOM reparenting)
```

- viewer / split / diff の3モードで条件分岐が複雑
- split-right が diff-only でも全子コンポーネントをマウント
- Terminal の DOM reparenting が React ツリーとブラウザ DOM を乖離させる

### 提案: レイアウトを3つの独立コンポーネントに分離

```
App
 └─ WorkerPoolContextProvider
      └─ ErrorBoundary
           ├─ Toolbar
           └─ div.app-body
                ├─ Sidebar (ResizableWidth)
                └─ LayoutSwitch (displayMode に基づく排他的レンダリング)
                     ├─ [diff]    DiffOnlyLayout
                     │             └─ DiffPane (検索バー内蔵)
                     │
                     ├─ [split]   SplitLayout
                     │             ├─ DiffPane (左)
                     │             ├─ ResizeHandle
                     │             └─ RightPane (右)
                     │                  ├─ RightPaneTabs (sticky)
                     │                  └─ Suspense
                     │                       ├─ [docs]     MarkdownViewer (lazy)
                     │                       ├─ [terminal] TerminalPane (lazy)
                     │                       └─ [review]   ReviewPanel (lazy)
                     │
                     └─ [viewer]  ViewerLayout
                                   ├─ MarkdownViewer (左)
                                   ├─ ResizeHandle
                                   └─ TerminalPane (右, lazy)
```

### 変更のポイント

**a. LayoutSwitch でモード別コンポーネントを排他的にレンダリング**

```tsx
// 現状: 条件分岐で1つの巨大コンポーネント内に全モードを詰め込む
// 提案: 各モードが独立したコンポーネント
const LayoutSwitch: React.FC = () => {
  const mode = useUiStore((s) => s.displayMode);

  switch (mode) {
    case "diff":    return <DiffOnlyLayout />;
    case "split":   return <SplitLayout />;
    case "viewer":  return <ViewerLayout />;
  }
};
```

- diff-only モードでは ReviewPanel, MarkdownViewer が一切マウントされない (C4 解決)
- 各レイアウトが自身のリサイズロジックを持ち、MainContent の肥大化を防止

**b. Terminal を React.lazy + Suspense でオンデマンドロード**

```tsx
const TerminalPane = React.lazy(() => import("./TerminalPane"));

// SplitLayout 内:
<Suspense fallback={<TerminalPlaceholder />}>
  <TerminalPane />
</Suspense>
```

- Terminal のバンドルコスト (xterm.js 200KB+) を初期ロードから除外
- `visible` prop による制御ではなく、コンポーネント自体をマウント/アンマウント

**c. Terminal の永続化: React.lazy + PortalではなくContextで管理**

```tsx
// TerminalContext: Terminal インスタンスをアプリ全体で共有
const TerminalContext = createContext<XTermInstance | null>(null);

// TerminalProvider (App レベル):
// - 初回 TerminalPane マウント時に XTerm インスタンスを生成
// - Context 経由でインスタンスを共有
// - TerminalPane はアンマウントされてもインスタンスは Context が保持
// - 再マウント時に containerRef に term.open() で再アタッチ

// DOM reparenting を排除し、React の正規のツリー構造を維持
```

---

## 3. DiffViewer の再描画最適化

### 現状の問題フロー

```
コメント1件追加
  → reviewStore.comments 変更
  → 全 DiffViewer が fileComments を再計算
  → lineAnnotations 再計算
  → Pierre options 再構築
  → @pierre/diffs が Shadow DOM を全再構築
```

### 提案: ファイル単位の購読 + annotation の分離

```tsx
// DiffViewer は自分のファイルのデータだけを購読
const DiffViewerOptimized: React.FC<{ filePath: string }> = React.memo(({ filePath }) => {
  // ファイル固有のコメントだけを購読 (他ファイルの変更で再描画されない)
  const fileComments = useReviewStore(
    useCallback((s) => s.comments.get(filePath) ?? EMPTY, [filePath])
  );

  // commentFormTarget もファイルで絞り込み
  const formTarget = useEditorStore(
    useCallback((s) => s.commentForm?.filePath === filePath ? s.commentForm : null, [filePath])
  );

  // Pierre options は displayStore のみに依存 (コメントに依存しない)
  const options = usePierreOptions(); // カスタムフック, memo済み

  // annotations は fileComments + formTarget のみから構築
  const annotations = useMemo(
    () => buildAnnotations(fileComments, formTarget),
    [fileComments, formTarget]
  );

  return (
    <PierreDiffComponent
      options={options}
      annotations={annotations}
      // ...
    />
  );
});
```

### options の参照安定性

```tsx
// 現状: DiffViewer 内で毎回 useMemo
// 問題: handleLineSelected の依存で options が不安定

// 提案: Pierre options をカスタムフックで一元管理
function usePierreOptions(): FileDiffOptions {
  const layout = useUiStore((s) => s.diffLayout);
  const overflow = useUiStore((s) => s.diffOverflow);
  const expand = useUiStore((s) => s.expandUnchanged);

  // onLineSelected は editorStore 経由で安定した参照
  const onLineSelected = useEditorStore((s) => s.setLineSelection);

  return useMemo(() => ({
    diffStyle: layout,
    overflow,
    expandUnchanged: expand,
    onLineSelected,
    // ... 他の固定オプション
  }), [layout, overflow, expand, onLineSelected]);
}
// → UI設定変更時のみ options が再生成される
// → コメント追加/削除では options は変わらない
```

---

## 4. Sidebar 再設計

### ファイル検索 (H1 解決)

```
┌─ Sidebar ──────────────────────┐
│ ┌─ SearchInput ──────────────┐ │
│ │ 🔍 Filter files...        │ │
│ └────────────────────────────┘ │
│                                │
│ ▼ Changed Files (3/47)         │  ← フィルタ適用後の件数 / 全件数
│   M  src/App.tsx          +5-2 │
│   A  src/hooks/useDiff.ts +42  │
│   M  src/store/index.ts   +1-1 │
│                                │
│ ▼ Documents                    │
│   📄 architecture.md           │
│   📄 api-guide.md              │
│                                │
│ ▼ Design Docs                  │
│   📐 review-flow.md            │
└────────────────────────────────┘
```

```tsx
// フィルタはローカルstate + useMemo で実装
const [filter, setFilter] = useState("");
const filteredFiles = useMemo(
  () => filter
    ? files.filter((f) => f.file.path.toLowerCase().includes(filter.toLowerCase()))
    : files,
  [files, filter]
);
```

### 仮想化 (H2 解決)

```tsx
// react-window の VariableSizeList でツリーをフラット化して仮想化
import { VariableSizeList } from "react-window";

const flatNodes = useMemo(() => flattenTree(fileTree, collapsedDirs), [fileTree, collapsedDirs]);

<VariableSizeList
  height={containerHeight}
  itemCount={flatNodes.length}
  itemSize={(i) => flatNodes[i].isDir ? 28 : 32}
>
  {({ index, style }) => <TreeRow node={flatNodes[index]} style={style} />}
</VariableSizeList>
```

---

## 5. ReviewPanel 再設計 — GitHub スレッドモデル (C2 解決)

### 現状の問題

```
1. ResolveMemoForm が全未解決コメントに同時表示 → 10件で10個のフォームが並ぶ
2. ✓ (解決) と ✕ (削除) の用途がアイコンだけでは不明
3. 解決メモは冗長 — 解決するならそれでライフサイクル終了
4. 「すぐ解決できない」ケースの体験が未整理
   — 追加の修正依頼や議論の返信ができない
```

### 参考モデル: GitHub Review Thread

GitHub のレビュー機能がこのユースケースに最も近い:
- 各コメントは「スレッド」の起点になる
- スレッド内に返信 (フラット, 孫なし) を追加できる
- 「Resolve conversation」はスレッド単位で、ワンクリック
- 解決メモという概念は不要 (返信が文脈を担う)

### 提案: スレッドベース ReviewPanel

```
┌─ ReviewPanel ─────────────────────────────────────┐
│ Review Comments (3 threads)        [Copy All]      │
├───────────────────────────────────────────────────┤
│                                                    │
│ ┌─ Thread ──────────────────────────────────────┐ │
│ │ src/App.tsx:L42                           📋  │ │
│ │ > const result = await fetch(url);            │ │
│ │ エラーハンドリングが不足しています              │ │
│ │                                               │ │
│ │   ↳ try-catch を追加しました — author          │ │  ← 返信 (子コメント)
│ │   ↳ catch 内で再throwした方が良いです — human  │ │  ← 返信 (子コメント)
│ │                                               │ │
│ │ ┌────────────────────────────────────────┐    │ │
│ │ │ Write a reply...                       │    │ │  ← 返信入力欄
│ │ └────────────────────────────────────────┘    │ │
│ │                        [Reply]  [Resolve]     │ │  ← 常に表示
│ └───────────────────────────────────────────────┘ │
│                                                    │
│ ┌─ Thread ──────────────────────────────────────┐ │
│ │ src/App.tsx:L55-L60                      📋  │ │
│ │ > function processData(input: any) {          │ │
│ │ any型を避けてください                         │ │
│ │                                               │ │
│ │ ┌────────────────────────────────────────┐    │ │
│ │ │ Write a reply...                       │    │ │
│ │ └────────────────────────────────────────┘    │ │
│ │                        [Reply]  [Resolve]     │ │
│ └───────────────────────────────────────────────┘ │
│                                                    │
│ ──── Resolved (1) ──────────────────────────────── │  ← 折りたたみ可能
│ ┌─ Thread (resolved) ──────────────────────────┐  │
│ │ ✓ src/store/index.ts:L12                 ↩   │  │  ← ↩ で解決取消
│ │   型エクスポートを修正                        │  │
│ └───────────────────────────────────────────────┘ │
│                                                    │
├───────────────────────────────────────────────────┤
│ Unresolved: 2 threads                              │
│                            [Approve]  [Reject]     │
└───────────────────────────────────────────────────┘
```

### 設計詳細

**a. 各スレッドのアクション**

| 操作 | UI | 条件 |
|------|-----|------|
| 返信 | テキスト入力 + [Reply] ボタン | 未解決スレッドのみ |
| 解決 | [Resolve] ボタン (ワンクリック) | 未解決スレッドのみ |
| テキスト入力 + 解決 | テキスト入力 + [Resolve] | 返信追加 & 即座に解決 |
| 解決取消 | [↩] ボタン | 解決済みスレッドのみ |
| コピー | [📋] ボタン | 常時 |
| 削除 | スレッドメニュー or スワイプ | 常時 (確認ダイアログ付き) |

**旧 ✓ (解決) と ✕ (削除) を廃止** — アイコンだけでは用途不明だった。
代わりに:
- 解決は明示的な `[Resolve]` ラベル付きボタン
- 削除はスレッドメニュー (…) 内に移動 (誤操作防止)

**b. [Reply] と [Resolve] の振る舞い**

```tsx
function ThreadFooter({ threadId }: { threadId: string }) {
  const [replyText, setReplyText] = useState("");
  const addReply = useReviewStore((s) => s.addReply);
  const resolveThread = useReviewStore((s) => s.resolveThread);

  const handleReply = () => {
    if (!replyText.trim()) return;
    addReply(threadId, replyText.trim());
    setReplyText("");
  };

  const handleResolve = () => {
    // テキストがあれば返信追加してから解決
    if (replyText.trim()) {
      addReply(threadId, replyText.trim());
    }
    resolveThread(threadId);
    setReplyText("");
  };

  return (
    <div className={styles.threadFooter}>
      <textarea
        className={styles.replyInput}
        placeholder="Write a reply..."
        value={replyText}
        onChange={(e) => setReplyText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleReply();
        }}
        rows={1}  // 自動拡張 (入力量に応じて高さ増加)
      />
      <div className={styles.threadActions}>
        <button
          onClick={handleReply}
          disabled={!replyText.trim()}
        >
          Reply
        </button>
        <button
          onClick={handleResolve}
          className={styles.resolveBtn}
        >
          Resolve
        </button>
      </div>
    </div>
  );
}
```

**c. Store アクション**

```typescript
// reviewStore に追加するアクション

// 返信を追加 (スレッドの replies に push)
addReply: (threadId: string, body: string) => {
  // threads Map 内の該当 thread を見つけて replies に追加
  // parent_id 概念は不要 — Thread 構造が親子を保証
};

// スレッドを解決 (ワンクリック, メモ不要)
resolveThread: (threadId: string) => {
  // thread.resolved = true, thread.resolved_at = Date.now()
};

// スレッドの解決を取消
unresolveThread: (threadId: string) => {
  // thread.resolved = false, thread.resolved_at = null
};

// スレッドを削除 (確認ダイアログ経由)
removeThread: (threadId: string) => {
  // threads Map から該当 thread を除去
};
```

**d. 解決済みセクション**

```tsx
// デフォルト折りたたみ — 解決済みは「終わった話」
const [showResolved, setShowResolved] = useState(false);

{resolvedThreads.length > 0 && (
  <details open={showResolved} onToggle={(e) => setShowResolved(e.currentTarget.open)}>
    <summary className={styles.resolvedHeader}>
      Resolved ({resolvedThreads.length})
    </summary>
    {resolvedThreads.map((t) => (
      <ResolvedThreadCard
        key={t.root.id}
        thread={t}
        onUnresolve={() => unresolveThread(t.root.id)}
      />
    ))}
  </details>
)}
```

**e. スレッド構造の制約 (孫コメント不可)**

型レベルで保証:
```typescript
interface ReviewThread {
  root: ReviewComment;         // 親: 1つ
  replies: ReviewComment[];    // 子: 0〜N (フラット)
  // ↑ ReviewThread[] ではなく ReviewComment[]
  // → 返信に対する返信 (孫) は構造的に不可能
  resolved: boolean;
  resolved_at: number | null;
}
```

UI レベルでも制約:
- 返信入力欄はスレッド末尾に1つだけ
- 個別の返信に「返信」ボタンは付かない

### ResolveMemoForm 廃止の根拠

| 旧フロー | 新フロー |
|----------|---------|
| ✓ クリック → メモ入力欄展開 → メモ記入 → 確定 (3ステップ) | [Resolve] クリック (1ステップ) |
| 解決の文脈はメモに書く | 解決の文脈は返信として残る (スレッド履歴) |
| メモは任意だが毎回フォームが出る | 返信は必要な時だけ書く |
| 全コメントにフォームが並ぶ (C2) | フォームは返信用のみ、コンパクト |

---

## 6. CSS デザイントークン再設計

### 6.1 現状の分析

**フォントサイズの使用実態 (全77宣言を集計)**

```
font-size-xs  (11px): 28回  ████████████████████████████  36%
font-size-sm  (12px): 27回  ███████████████████████████   35%
font-size-base(13px):  3回  ███                            4%  ← "base" なのにほぼ未使用
font-size-md  (14px):  4回  ████                           5%
font-size-lg  (16px):  2回  ██                             3%
ハードコード:         13回  █████████████                 17%  ← トークン未使用
  10px ×4, 12px ×3, 13px ×1, 14px ×1, 15px ×1, 16px ×1, 20px ×1, 24px ×1
```

**問題点**:

1. **「base」が base ではない** — 13px は 3回しか使われず、実際の主役は xs(11px) と sm(12px)
2. **5段階中3段階 (11/12/13px) が1pxずつの差** — 視覚的にほぼ区別不能、階層感が生まれない
3. **10px が 4箇所** — WCAG SC 1.4.4 (テキストの拡大) で推奨される最小サイズを下回る
4. **13件のハードコード値** — トークンシステムが浸透していない
5. **全て px 固定** — ブラウザのフォント設定を変更しても反映されない

**spacing の使用実態**

```
トークン使用:  gap, padding でトークン使用率 ≈ 70%
ハードコード:  padding: 1px 6px, 2px, 0 5px, 1px 5px 等
               → 4px グリッドを逸脱する値が多数
```

**line-height の使用実態**

```
1.5  (2箇所), 1.0 (3箇所), 1.6 (1箇所), 1.8 (1箇所), 20px (1箇所)
→ 体系なし、場当たり的
```

---

### 6.2 rem と 4px グリッドの関係

ユーザーが知っている「px で 4 の倍数」は rem でもそのまま使えます。

```
ブラウザのデフォルト: 1rem = 16px

0.25rem =  4px    ← 4 の倍数の最小単位
0.5rem  =  8px
0.75rem = 12px
1rem    = 16px
1.5rem  = 24px
2rem    = 32px
3rem    = 48px
```

**なぜ rem を使うのか**:
px は「絶対値」なので、ユーザーがブラウザの文字サイズを「大」に変更しても
px で指定した要素は一切変わりません。
rem はブラウザのルートフォントサイズに連動するため、
ユーザーの設定変更に自動で追従し、アクセシビリティを確保できます。

**「1rem を基準にすべきでは」という疑問への回答**:

- `1rem` はブラウザのデフォルト (16px) を意味する単位であり、
  アプリの base font size とは別の概念です
- 開発ツールの UI テキストは 14px が業界標準
  (VS Code: 13px, GitHub: 14px, Figma: 13px)
- したがって `--font-size-base: 0.875rem` (= 14px) は適切です
- ただし「1rem = base」にしたい場合は
  `html { font-size: 87.5%; }` と宣言すれば `1rem = 14px` にできます
- 後者はサードパーティコンポーネント (@pierre/diffs, xterm.js) の
  想定する 1rem を狂わせるリスクがあるため、**推奨しません**

---

### 6.3 フォントサイズスケール再設計

**現状: 5段階、ほぼ区別不能**

```
xs=11  sm=12  base=13  md=14  lg=16    (px)
  △1     △1      △1     △2
```

**提案: 4段階、明確なコントラスト**

```
sm=12  base=14  lg=16  xl=20    (px)
  △2      △2     △4

sm     = 0.75rem   (12px)  メタデータ, バッジ, タイムスタンプ
base   = 0.875rem  (14px)  本文, ボタン, 入力フォーム, ツリー
lg     = 1rem      (16px)  セクション見出し, ファイル名ヘッダー
xl     = 1.25rem   (20px)  ページタイトル (使用頻度: 低)
```

**設計根拠**:

1. **段階間の差を 2px 以上にする**
   — 1px の差 (11 vs 12, 12 vs 13) は人間の目で区別が難しく、
   タイポグラフィ階層として機能しない

2. **xs (11px) と 10px を廃止**
   — 現状 xs=11px が 28回使われているが、
   これは「小さく見せたい」意図で乱用されている
   — 情報密度は font-size を下げるのではなく、
   color (secondary/tertiary) と font-weight で表現すべき
   — 例: 変更行数 `+5 -2` は font-size-xs(11px) ではなく
   font-size-sm(12px) + color-text-secondary で十分区別できる

3. **lg = 1rem にする**
   — 「1rem を意識しやすい」という直感に応える
   — セクション見出しやファイルヘッダーという「目立つべき要素」に使うため、
   「1rem = ブラウザの推奨サイズ = 見出し」という意味的な一致がある

4. **base は変えない (0.875rem = 14px)**
   — 開発ツールの UI テキスト標準
   — コードリーディングが主用途なので、
   16px base だと密度が不足し画面内の情報量が減る

**マイグレーション方針: xs → sm / base への統合**

```
現状の xs (11px) 28回の使用先を分類:

a. メタデータ・補助情報 (20箇所)
   → sm (12px) に変更 + color-text-secondary で補助的に見せる
   例: ファイルサイズ, タイムスタンプ, バッジ, ステータスラベル

b. 極小UI要素 (8箇所)
   → padding 調整で対応、font-size は sm (12px) に統一
   例: ツリーの折りたたみアイコン脇テキスト, 行番号
```

---

### 6.4 スペーシングスケール (rem)

**現状: px ベース (既に 4の倍数)**

```css
--space-1: 4px;   --space-2: 8px;   --space-3: 12px;
--space-4: 16px;  --space-5: 24px;  --space-6: 32px;
```

**提案: rem ベース (4px グリッドを維持)**

```css
--space-1: 0.25rem;   /*  4px */
--space-2: 0.5rem;    /*  8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-5: 1.5rem;    /* 24px */
--space-6: 2rem;      /* 32px */
```

変換ルールは単純: **px ÷ 16 = rem**。覚えるのはこれだけです。

| 4px グリッド | rem |
|-------------|-----|
| 4px | 0.25rem |
| 8px | 0.5rem |
| 12px | 0.75rem |
| 16px | 1rem |
| 24px | 1.5rem |
| 32px | 2rem |
| 48px | 3rem |

**ハードコード値の修正方針**

```
padding: 1px 6px  → padding: 0.125rem 0.375rem  → ❌ グリッド逸脱
                  → padding: var(--space-1) var(--space-2) に近似  → ✅

padding: 2px      → padding: 0.25rem (= --space-1) に統一
padding: 0 5px    → padding: 0 var(--space-2) (= 0.5rem = 8px) に近似
padding: 6px 14px → padding: var(--space-2) var(--space-4) に近似
```

原則: **4px グリッドに乗らない値 (1px, 2px, 3px, 5px, 6px, 14px) は
最も近い 4px 倍数に丸める**。1px の違いはユーザーに知覚されない。

---

### 6.5 line-height スケール

**現状: 体系なし (1, 1.5, 1.6, 1.8, 20px)**

**提案: 3段階**

```css
--line-height-tight: 1.25;  /* ボタン, バッジ, 単行要素 */
--line-height-base:  1.5;   /* 本文, コメント, UI テキスト */
--line-height-loose: 1.75;  /* Markdown 本文 (長文の可読性) */
```

- **無単位**の比率で統一 (px 指定の `20px` は廃止)
- 無単位なら font-size が変わっても比率を維持する
- `line-height: 1` (現状 3箇所) は `1.25` に変更
  — `line-height: 1` はアセンダー/ディセンダーが切れるリスクがある

---

### 6.6 border-radius スケール

**現状**:
```css
--radius-sm: 4px;   --radius-md: 6px;   --radius-lg: 8px;
```

**問題**: 6px は 4px グリッドに乗っていない

**提案**:
```css
--radius-sm: 0.25rem;  /*  4px — ボタン, バッジ, インライン要素 */
--radius-md: 0.5rem;   /*  8px — カード, パネル, 入力フォーム */
--radius-lg: 0.75rem;  /* 12px — モーダル, 大きなコンテナ */
```

---

### 6.7 インタラクティブ要素の最小サイズ

**現状**: `height: 16px`, `height: 20px`, `height: 22px` のボタンが存在

**問題**: WCAG 2.5.8 (Target Size) は最小 24×24px を要求

**提案**:
```css
--interactive-min-size: 1.5rem;  /* 24px — 最小タッチ/クリックターゲット */
--interactive-comfortable: 2rem; /* 32px — 推奨タッチターゲット */
```

```css
/* 全インタラクティブ要素に適用 */
button, [role="button"], a, input, select, textarea {
  min-height: var(--interactive-min-size);
  min-width: var(--interactive-min-size);
}
```

---

### 6.8 tokens.css 全体像

```css
/* tokens.css — Tasuki Design System Tokens */
:root {
  /* ── Color ── */
  /* (既存のカラートークンは変更なし — 省略) */

  /* ── Typography ── */
  --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans",
    Helvetica, Arial, sans-serif;
  --font-mono: "SF Mono", "Fira Code", "Fira Mono", "Roboto Mono", Menlo,
    Consolas, monospace;

  --font-size-sm:   0.75rem;   /* 12px — メタデータ, 補助テキスト */
  --font-size-base: 0.875rem;  /* 14px — 本文, UI コントロール */
  --font-size-lg:   1rem;      /* 16px — セクション見出し */
  --font-size-xl:   1.25rem;   /* 20px — ページタイトル */

  --line-height-tight: 1.25;   /* ボタン, バッジ */
  --line-height-base:  1.5;    /* 本文 */
  --line-height-loose: 1.75;   /* Markdown 長文 */

  --font-weight-normal:   400;
  --font-weight-medium:   500;
  --font-weight-semibold: 600;

  /* ── Spacing (4px grid → 0.25rem 単位) ── */
  --space-1: 0.25rem;   /*  4px */
  --space-2: 0.5rem;    /*  8px */
  --space-3: 0.75rem;   /* 12px */
  --space-4: 1rem;      /* 16px */
  --space-5: 1.5rem;    /* 24px */
  --space-6: 2rem;      /* 32px */
  --space-8: 3rem;      /* 48px */

  /* ── Border Radius (4px grid) ── */
  --radius-sm: 0.25rem;  /*  4px */
  --radius-md: 0.5rem;   /*  8px */
  --radius-lg: 0.75rem;  /* 12px */

  /* ── Layout ── */
  --sidebar-width: 260px;       /* px 維持 (固定幅コンテナ) */
  --toolbar-height: 3rem;       /* 48px → rem */
  --interactive-min: 1.5rem;    /* 24px 最小タッチターゲット */
  --interactive-comfortable: 2rem; /* 32px 推奨タッチターゲット */

  /* ── Resize Handle ── */
  --resize-handle-width: 4px;
  --resize-handle-hitarea: 12px;

  /* ── Z-Index Layers ── */
  --z-base: 0;
  --z-sticky: 10;
  --z-dropdown: 100;
  --z-overlay: 500;
  --z-modal: 1000;

  /* ── Pierre Integration ── */
  --diffs-font-family: var(--font-mono);
  --diffs-font-fallback: Menlo, Consolas, monospace;
  --diffs-header-font-family: var(--font-sans);
  --diffs-font-size: var(--font-size-base);
  --diffs-line-height: var(--line-height-base);
  --diffs-tab-size: 4;
  --diffs-gap-inline: var(--space-2);
}
```

### 6.9 マイグレーション影響まとめ

```
変更前                    変更後                    影響
─────────────────────────────────────────────────────────────────
--font-size-xs: 11px      廃止                     28箇所を sm/base に振り分け
--font-size-sm: 12px      0.75rem (12px)           値は同じ、単位だけ変更
--font-size-base: 13px    0.875rem (14px)          ← 1px 大きくなる (3箇所のみ)
--font-size-md: 14px      廃止 (base に統合)       4箇所を base に変更
--font-size-lg: 16px      1rem (16px)              値は同じ、単位だけ変更
(なし)                    --font-size-xl: 1.25rem  新規追加 (20px, 24px の統一先)
ハードコード 10px ×4      sm (0.75rem) に統一      可読性向上
ハードコード 12px ×3      sm (0.75rem) に統一      トークン使用
--radius-md: 6px          0.5rem (8px)             2px 大きくなる
line-height: 1 ×3         1.25                     テキスト切れ防止
line-height: 20px ×1      --line-height-base       比率化
```

### 6.10 CSS アーキテクチャ (ファイル分割)

```
src/styles/
  ├─ tokens.css        CSS変数定義 (上記の全トークン)
  ├─ reset.css         box-sizing, margin/padding リセット
  ├─ global.css        html, body, #root, a のベーススタイル
  └─ pierre.css        @pierre/diffs Shadow DOM へ注入する追加スタイル

src/components/
  ├─ Toolbar/
  │    ├─ Toolbar.tsx
  │    └─ Toolbar.module.css
  ├─ Sidebar/
  │    ├─ Sidebar.tsx
  │    └─ Sidebar.module.css
  ├─ ReviewPanel/
  │    ├─ ReviewPanel.tsx
  │    ├─ ThreadCard.tsx
  │    ├─ ThreadFooter.tsx
  │    └─ ReviewPanel.module.css
  ...
```

CSS Modules の利点:
- クラス名の自動スコープ (`.handle` → `.ResizeHandle_handle_a1b2c`)
- 名前衝突を構造的に不可能にする
- 未使用クラスの検出が容易 (import 追跡)
- Vite が標準サポート (設定不要)

---

## 7. アクセシビリティ (H3 解決)

### キーボードナビゲーション設計

```
Tab順序:
  Toolbar → Sidebar → Main Content

Toolbar 内:
  Tab / Shift+Tab でボタン間移動
  Enter / Space でアクティベート

Sidebar 内:
  ↑↓ でファイル/ドキュメント間移動
  ←→ でツリー展開/折りたたみ
  Enter でファイル選択
  / でフィルタ入力にフォーカス (vim風)

Diff 内:
  j/k で変更ファイル間移動 (vim風)
  n/N で次/前の差分ハンクへジャンプ
  c でコメントフォーム開始
  Escape でコメントフォーム閉じ

Review Panel 内:
  ↑↓ でコメント間移動
  Enter で解決フォーム開始
  Escape でフォーム閉じ
```

### ARIA 属性

```tsx
// Sidebar: tree view パターン
<ul role="tree" aria-label="Changed files">
  <li role="treeitem" aria-expanded={!collapsed} aria-selected={selected}>
    ...
  </li>
</ul>

// Right Pane: tabpanel パターン
<div role="tablist">
  <button role="tab" aria-selected={active} aria-controls="panel-docs">Docs</button>
</div>
<div role="tabpanel" id="panel-docs" aria-labelledby="tab-docs">
  ...
</div>

// リサイズハンドル
<div
  role="separator"
  aria-orientation="vertical"
  aria-valuenow={ratio * 100}
  aria-valuemin={20}
  aria-valuemax={80}
  aria-label="Resize pane"
  tabIndex={0}
  onKeyDown={(e) => {
    if (e.key === "ArrowLeft") adjustRatio(-0.05);
    if (e.key === "ArrowRight") adjustRatio(+0.05);
  }}
/>
```

---

## 8. Terminal 再設計

### 現状の問題

- DOM reparenting で React ツリーとブラウザ DOM が乖離
- visible prop による制御（常にマウント）
- バンドルサイズに常に含まれる (xterm.js ~200KB)

### 提案: Context + lazy + Portal なし

```tsx
// TerminalManager: XTerm インスタンスのライフサイクルを管理
class TerminalManager {
  private term: XTerm | null = null;
  private spawned = false;

  async init(container: HTMLElement): Promise<void> {
    if (this.term) {
      // 再アタッチ (コンテナが変わった場合)
      this.term.open(container);
      this.fit();
      return;
    }
    // 新規生成
    this.term = new XTerm({ /* ... */ });
    this.term.open(container);
    // addons, listeners...
    await this.spawn();
  }

  detach(): void {
    // コンテナからの切り離し (インスタンスは破棄しない)
    // xterm.js の内部状態は保持される
  }

  dispose(): void {
    this.term?.dispose();
    this.term = null;
  }
}

// React 側:
const terminalManager = useRef(new TerminalManager());

const TerminalPane = React.lazy(() => import("./TerminalPane"));

// TerminalPane.tsx:
function TerminalPane() {
  const containerRef = useRef<HTMLDivElement>(null);
  const manager = useContext(TerminalManagerContext);

  useEffect(() => {
    if (containerRef.current) {
      manager.init(containerRef.current);
    }
    return () => manager.detach();
  }, [manager]);

  return <div ref={containerRef} className={styles.terminal} />;
}
```

**利点**:
- DOM reparenting 不要 (React のツリー = ブラウザの DOM)
- コード分割で初期バンドルから除外
- マウント/アンマウントしてもセッション保持

---

## 9. エラーハンドリング・ローディング統一

### 提案: 統一的な非同期状態管理

```tsx
// useAsyncAction: ローディング + エラーを統一管理するフック
function useAsyncAction<T>(
  action: () => Promise<T>,
  options?: { timeout?: number }
): {
  execute: () => Promise<T | undefined>;
  isLoading: boolean;
  error: string | null;
  reset: () => void;
} {
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await withTimeout(action(), options?.timeout ?? 10000);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [action, options?.timeout]);

  return { execute, isLoading, error, reset: () => setError(null) };
}
```

### スケルトンローディング

```tsx
// MarkdownViewer のローディング状態
function MarkdownSkeleton() {
  return (
    <div className={styles.skeleton}>
      <div className={styles.skeletonTitle} />   {/* 太い短いバー */}
      <div className={styles.skeletonLine} />    {/* 細い長いバー */}
      <div className={styles.skeletonLine} />
      <div className={styles.skeletonShort} />   {/* 細い短いバー */}
      <div className={styles.skeletonLine} />
    </div>
  );
}
```

---

## 10. 提案コンポーネントツリー (最終形)

```
App
 ├─ hooks: useInitialize()  ← 初期化ロジックを1つのフックに集約
 │
 └─ TerminalManagerProvider  ← Terminal インスタンスのライフサイクル管理
      └─ WorkerPoolContextProvider
           └─ ErrorBoundary
                └─ div.app
                     ├─ Toolbar
                     │    ├─ RepoInfo
                     │    ├─ ModeTabGroup (Diff / Split / Viewer)
                     │    └─ DiffControls (mode !== viewer 時のみ描画)
                     │
                     └─ div.app-body
                          ├─ Sidebar (ResizableWidth HOC)
                          │    ├─ SearchInput
                          │    ├─ VirtualizedFileTree (react-window)
                          │    ├─ DocSection
                          │    └─ DesignDocSection
                          │
                          └─ LayoutSwitch
                               ├─ [diff]   DiffLayout
                               │            └─ DiffPane
                               │                 ├─ DiffSearchBar (Cmd+F 時)
                               │                 └─ VirtualizedDiffList
                               │                      └─ DiffFileView × N (React.memo)
                               │
                               ├─ [split]  SplitLayout (ResizablePane)
                               │            ├─ DiffPane (左)
                               │            └─ RightTabbedPane (右)
                               │                 ├─ StickyTabBar
                               │                 └─ Suspense
                               │                      ├─ MarkdownViewer (lazy)
                               │                      ├─ TerminalPane (lazy)
                               │                      └─ ReviewPanel (lazy)
                               │                           ├─ UnresolvedSection
                               │                           │    └─ ThreadCard × N
                               │                           │         ├─ RootComment
                               │                           │         ├─ ReplyComment × M
                               │                           │         └─ ThreadFooter (reply input + [Reply] + [Resolve])
                               │                           ├─ ResolvedSection (collapsible, <details>)
                               │                           │    └─ ResolvedThreadCard × N (compact, [↩] unresolve)
                               │                           └─ VerdictBar
                               │
                               └─ [viewer] ViewerLayout (ResizablePane)
                                            ├─ MarkdownViewer (左)
                                            └─ Suspense
                                                 └─ TerminalPane (lazy, 右)
```

---

## 11. 再描画フロー比較

### コメント追加時 (新規スレッド作成)

```
現状:
  addComment()
  → reviewStore.comments 配列が新しい参照に
  → FileSidebar 再描画 (badge計算)
  → DiffViewer × 50 全て再描画 (fileComments フィルタ再実行)
  → ReviewPanel 再描画
  合計: 52 コンポーネント再描画

提案:
  addThread("src/App.tsx", rootComment)
  → reviewStore.threads.get("src/App.tsx") のみ新しい参照に
  → DiffFileView("src/App.tsx") のみ再描画 (selector が一致)
  → ReviewPanel 再描画 (スレッド一覧更新)
  → Sidebar のバッジは useSyncExternalStore で最小限更新
  合計: 3 コンポーネント再描画
```

### 返信追加時

```
提案:
  addReply(threadId, replyBody)
  → 該当スレッドの replies のみ更新
  → ThreadCard (該当スレッド1つ) のみ再描画
  → DiffFileView は再描画されない (スレッド数や root は変わらないため)
  合計: 1 コンポーネント再描画
```

### スレッド解決時

```
提案:
  resolveThread(threadId)
  → thread.resolved = true (ワンクリック, メモ不要)
  → ThreadCard が UnresolvedSection → ResolvedSection へ移動
  → ReviewPanel の unresolvedCount 更新 (Approve ボタンの活性化判定)
  合計: 2 コンポーネント再描画 (ThreadCard + VerdictBar)
```

### モード切替時

```
現状:
  setDisplayMode("split")
  → MainContent 全体が再描画
  → split-right 内の MarkdownViewer, ReviewPanel が display変更
  → Terminal useEffect で DOM reparenting

提案:
  setDisplayMode("split")
  → LayoutSwitch が DiffLayout をアンマウント、SplitLayout をマウント
  → DiffPane は既にマウント済み (共有コンポーネント、state 維持)
  → RightTabbedPane 初回マウント (Suspense で lazy load)
  → Terminal は TerminalManagerProvider が状態保持、TerminalPane 初回マウント時に再アタッチ
```

---

## 12. マイグレーション戦略

段階的に移行する場合の優先順位:

```
Phase 1 (即効性が高い、既存構造で実施可能)
  ├─ reviewStore をスレッドモデルに変更 (Map<string, Thread[]>)
  ├─ DiffViewer にファイル単位の selector を適用
  ├─ ResolveMemoForm 廃止 → ThreadFooter (reply + resolve) に置換
  ├─ 返信機能の追加 (フラット, 孫なし)
  └─ 右ペインタブを sticky に修正

Phase 2 (Store 分離)
  ├─ diffStore → diffStore + docStore + editorStore に分割
  ├─ LeftPaneMode → RightPaneMode に改名
  └─ 検索状態を editorStore に移動 (ファイル切替で消えない)

Phase 3 (レイアウト再設計)
  ├─ MainContent → LayoutSwitch + 3つのレイアウトコンポーネント
  ├─ Terminal を React.lazy + TerminalManager に移行
  └─ split-right の常時マウントを排除

Phase 4 (CSS + アクセシビリティ)
  ├─ CSS Modules 移行
  ├─ rem ベースのフォントサイズ
  ├─ ARIA属性の追加
  ├─ キーボードナビゲーション実装
  └─ リサイズハンドルのヒットエリア拡大

Phase 5 (仮想化 + パフォーマンス)
  ├─ サイドバーの仮想化 (react-window)
  ├─ サイドバー検索/フィルタ
  └─ DiffList の仮想化 (大規模changeset対応)
```
