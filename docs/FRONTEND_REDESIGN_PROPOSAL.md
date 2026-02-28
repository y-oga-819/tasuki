# フロントエンド再設計 設計仕様書

## 対象課題

本設計で解決する課題の一覧。各課題 ID は設計内の該当セクションから参照される。

### Critical

| ID | 課題 | 解決セクション |
|----|------|---------------|
| C1 | 全 DiffViewer が全コメント変更で再描画される | §3 DiffViewer 最適化 |
| C2 | ResolveMemoForm が全未解決コメントに同時表示される | §5 ReviewPanel |
| C3 | diffStore が5つの責務を兼務 (27フィールド) | §1 Store 設計 |
| C4 | split-right が diff-only モードでも全マウントされる | §2 コンポーネントツリー |

### High

| ID | 課題 | 解決セクション |
|----|------|---------------|
| H1 | サイドバーに検索/フィルタなし | §4 Sidebar |
| H2 | サイドバーに仮想化なし | §4 Sidebar |
| H3 | キーボードナビゲーション・ARIA 属性の欠落 | §7 アクセシビリティ |
| H4 | 右ペインタブが sticky でない | §2 コンポーネントツリー |
| H5 | 解決フォームが click-outside で閉じない | §5 ReviewPanel |
| H6 | Cmd+F のコンテキスト競合 (diff vs terminal) | §2 コンポーネントツリー |
| H7 | API 呼び出しにタイムアウトなし | §9 エラーハンドリング |

### Medium

| ID | 課題 | 解決セクション |
|----|------|---------------|
| M1 | レスポンシブ対応なし (media query ゼロ) | §6 CSS トークン |
| M2 | CSS が 1ファイル 2000行、スコープなし | §6.8 CSS アーキテクチャ |
| M3 | リサイズハンドルが 4px (タッチ不可) | §6.5 インタラクティブ要素 |
| M4 | ローディング/エラー状態が貧弱 | §9 エラーハンドリング |
| M5 | Terminal の色が JS 内ハードコード | §8 Terminal |
| M6 | `LeftPaneMode` が右ペインを制御 (命名矛盾) | §1 Store 設計 |
| M7 | 検索状態がファイル切替で消失 | §1 Store 設計 |

---

## 設計原則

```
1. Fine-Grained Reactivity  — 変更が影響するコンポーネントだけが再描画される
2. Progressive Disclosure    — 必要なときに必要なものだけ表示する
3. Accessibility First       — キーボード・スクリーンリーダー対応を基盤に組み込む
4. Lazy Everything           — 使わないものは生成しない (Terminal, 右ペイン, 検索)
5. CSS Scoping               — CSS Modules でスタイルの衝突を根絶する
6. Derived > Stored          — 計算できるものは store に保存しない
```

---

## 1. Store 設計

現状の 3 store (diffStore 27項目 + displayStore 7項目 + reviewStore 8項目) を
責務ごとに 5 store へ分割する。 [C3, M6, M7]

```
┌──────────────────┐
│ diffStore (8項目) │  diff データに集中
│  diffResult      │
│  diffSource      │
│  isLoading       │
│  error           │
│  repoPath        │
│  repoInfo        │
│  selectedFile    │
│  collapsedFiles  │
└──────────────────┘
┌──────────────────┐
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
│ uiStore (7項目)   │  旧 displayStore + 命名修正
│  displayMode     │
│  rightPaneMode   │  ← LeftPaneMode から改名 [M6]
│  diffLayout      │
│  diffOverflow    │
│  expandUnchanged │
│  tocOpen         │
│  mdViewMode      │
└──────────────────┘
┌──────────────────┐
│ reviewStore      │  スレッドモデル
│  threads         │  ← Map<fileId, ReviewThread[]>
│  docComments     │
│  verdict         │
│  gateStatus      │
└──────────────────┘
┌──────────────────┐
│ editorStore      │  diff 内インタラクション専用
│  lineSelection   │  { range, file } を1つのオブジェクトに統合
│  commentForm     │  commentFormTarget
│  searchQuery     │  diff 検索状態 (ファイル切替でも維持) [M7]
│  searchMatches   │
└──────────────────┘
```

### 1.1 スレッドモデル [C1]

```typescript
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
```

旧モデルからの変更:
- `parent_id` フィールド廃止 — `ReviewThread` が構造的に親子関係を表現
- `resolution_memo` 廃止 — 返信で代替
- `resolved` はスレッドの属性 (個々のコメントではない)
- 孫コメント不可は型レベルで保証 (`replies` が `ReviewComment[]` であり `ReviewThread[]` ではない)

Store のデータ構造:

```typescript
// ファイルパスでインデックス化
threads: Map<string, ReviewThread[]>
// ├─ "src/App.tsx" → [thread1, thread2]
// └─ "src/store/diffStore.ts" → [thread3]

// DiffViewer は自分のファイルのスレッドだけを購読:
const fileThreads = useReviewStore(
  (s) => s.threads.get(filePath) ?? EMPTY_ARRAY
);
// → 他ファイルのコメント変更で再描画されない
```

### 1.2 行選択の統合

```typescript
// 2つの独立フィールドを1つのオブジェクトに統合 (不整合リスク排除)
lineSelection: {
  file: string;
  range: SelectedLineRange;
} | null;  // null = 選択なし
```

---

## 2. コンポーネントツリー

レイアウトを3つの独立コンポーネントに分離し、
LayoutSwitch で displayMode に基づいて排他的にレンダリングする。 [C4, H4, H6]

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
                     │                  ├─ RightPaneTabs (sticky) [H4]
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

### 2.1 LayoutSwitch

```tsx
const LayoutSwitch: React.FC = () => {
  const mode = useUiStore((s) => s.displayMode);

  switch (mode) {
    case "diff":    return <DiffOnlyLayout />;
    case "split":   return <SplitLayout />;
    case "viewer":  return <ViewerLayout />;
  }
};
```

- diff-only モードでは ReviewPanel, MarkdownViewer が一切マウントされない [C4]
- 各レイアウトが自身のリサイズロジックを持つ
- Cmd+F はアクティブなレイアウト内でのみ発火する [H6]

### 2.2 Terminal の遅延ロードと永続化

```tsx
const TerminalPane = React.lazy(() => import("./TerminalPane"));

// SplitLayout 内:
<Suspense fallback={<TerminalPlaceholder />}>
  <TerminalPane />
</Suspense>
```

Terminal インスタンスのライフサイクルは TerminalManagerProvider (App レベル) が管理し、
TerminalPane のマウント/アンマウントに関わらずセッションを保持する。
DOM reparenting は使用しない。詳細は §8 参照。

---

## 3. DiffViewer 最適化 [C1]

ファイル単位の購読と annotation の分離により、
コメント変更時の再描画を対象ファイルのみに限定する。

### 3.1 ファイル単位の購読

```tsx
const DiffViewerOptimized: React.FC<{ filePath: string }> = React.memo(({ filePath }) => {
  // ファイル固有のコメントだけを購読 (他ファイルの変更で再描画されない)
  const fileComments = useReviewStore(
    useCallback((s) => s.comments.get(filePath) ?? EMPTY, [filePath])
  );

  // commentFormTarget もファイルで絞り込み
  const formTarget = useEditorStore(
    useCallback((s) => s.commentForm?.filePath === filePath ? s.commentForm : null, [filePath])
  );

  // Pierre options は uiStore のみに依存 (コメントに依存しない)
  const options = usePierreOptions();

  // annotations は fileComments + formTarget のみから構築
  const annotations = useMemo(
    () => buildAnnotations(fileComments, formTarget),
    [fileComments, formTarget]
  );

  return (
    <PierreDiffComponent
      options={options}
      annotations={annotations}
    />
  );
});
```

### 3.2 Pierre options の参照安定性

```tsx
function usePierreOptions(): FileDiffOptions {
  const layout = useUiStore((s) => s.diffLayout);
  const overflow = useUiStore((s) => s.diffOverflow);
  const expand = useUiStore((s) => s.expandUnchanged);
  const onLineSelected = useEditorStore((s) => s.setLineSelection);

  return useMemo(() => ({
    diffStyle: layout,
    overflow,
    expandUnchanged: expand,
    onLineSelected,
  }), [layout, overflow, expand, onLineSelected]);
}
// UI 設定変更時のみ options が再生成される
// コメント追加/削除では options は変わらない
```

---

## 4. Sidebar [H1, H2]

### 4.1 ファイル検索

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
const [filter, setFilter] = useState("");
const filteredFiles = useMemo(
  () => filter
    ? files.filter((f) => f.file.path.toLowerCase().includes(filter.toLowerCase()))
    : files,
  [files, filter]
);
```

### 4.2 仮想化

react-window の VariableSizeList でツリーをフラット化して仮想化する。

```tsx
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

## 5. ReviewPanel — スレッドモデル [C2, H5]

GitHub の Review Thread をモデルとし、スレッドベースの ReviewPanel に再設計する。
ResolveMemoForm は廃止し、解決はワンクリック、文脈は返信で残す。

### 5.1 レイアウト

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
│ │   ↳ try-catch を追加しました — author          │ │  ← 返信
│ │   ↳ catch 内で再throwした方が良いです — human  │ │  ← 返信
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

### 5.2 スレッドアクション

| 操作 | UI | 条件 |
|------|-----|------|
| 返信 | テキスト入力 + [Reply] ボタン | 未解決スレッドのみ |
| 解決 | [Resolve] ボタン (ワンクリック) | 未解決スレッドのみ |
| テキスト入力 + 解決 | テキスト入力 + [Resolve] | 返信追加 & 即座に解決 |
| 解決取消 | [↩] ボタン | 解決済みスレッドのみ |
| コピー | [📋] ボタン | 常時 |
| 削除 | スレッドメニュー (…) 内 | 常時 (確認ダイアログ付き) |

旧アイコンボタン (✓ 解決 / ✕ 削除) は廃止。
解決は明示的な `[Resolve]` ラベル付きボタン、
削除はメニュー内に移動し誤操作を防止する。

### 5.3 ThreadFooter コンポーネント

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
        rows={1}
      />
      <div className={styles.threadActions}>
        <button onClick={handleReply} disabled={!replyText.trim()}>
          Reply
        </button>
        <button onClick={handleResolve} className={styles.resolveBtn}>
          Resolve
        </button>
      </div>
    </div>
  );
}
```

### 5.4 Store アクション

```typescript
addReply: (threadId: string, body: string) => {
  // threads Map 内の該当 thread の replies に追加
};

resolveThread: (threadId: string) => {
  // thread.resolved = true, thread.resolved_at = Date.now()
};

unresolveThread: (threadId: string) => {
  // thread.resolved = false, thread.resolved_at = null
};

removeThread: (threadId: string) => {
  // threads Map から該当 thread を除去 (確認ダイアログ経由)
};
```

### 5.5 解決済みセクション

デフォルト折りたたみ。解決済みは「終わった話」として扱う。

```tsx
{resolvedThreads.length > 0 && (
  <details>
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

---

## 6. CSS デザイントークン

全トークンを rem ベースに統一し、4px グリッドを維持する。
ブラウザのフォント設定に追従するアクセシビリティを確保する。

rem の換算: `px ÷ 16 = rem` (ブラウザデフォルト 1rem = 16px)

| 4px グリッド | rem |
|-------------|-----|
| 4px | 0.25rem |
| 8px | 0.5rem |
| 12px | 0.75rem |
| 16px | 1rem |
| 24px | 1.5rem |
| 32px | 2rem |
| 48px | 3rem |

`html { font-size }` の変更は行わない。
`--font-size-base: 0.875rem (14px)` は開発ツールの業界標準に合わせた値であり、
サードパーティコンポーネント (@pierre/diffs, xterm.js) が想定する
`1rem = 16px` との互換性を維持する。

### 6.1 フォントサイズスケール

5トークン (4段階 + prose)。段階間の差は最低 2px 以上とし、
視覚的に明確なタイポグラフィ階層を構成する。

```
UIスケール:  sm=12  base=14  lg=16  xl=20    (px)
               △2      △2     △4
散文:                         prose=16
```

| トークン | 値 | px | 用途 |
|---------|-----|-----|------|
| `--font-size-sm` | 0.75rem | 12px | メタデータ, バッジ, タイムスタンプ |
| `--font-size-base` | 0.875rem | 14px | UI テキスト, diff, コード, ボタン, ツリー |
| `--font-size-prose` | 1rem | 16px | Markdown 本文 (日本語の可読性確保) |
| `--font-size-lg` | 1rem | 16px | セクション見出し, ファイル名ヘッダー |
| `--font-size-xl` | 1.25rem | 20px | ページタイトル |

`prose` と `lg` は同じ 1rem (16px) だがセマンティクスが異なる:
- `prose` = 散文本文 (MarkdownViewer の本文)
- `lg` = UI 見出し (ツールバー, サイドバーヘッダー)

同じ値でもトークンを分けることで、将来一方だけ変更する自由度を残す。

**コード vs 散文で文字サイズを分ける根拠**:

日本語漢字はラテン文字より画数が多く、14px ではストローク潰れのリスクがある。
コードはスキャン (パターン認識)、文章はリーディング (連続読み) で
読み方が根本的に異なるため、異なるサイズは不整合ではなく適切な使い分け。
GitHub, Notion, Zenn 等もコード 14px / 散文 16px で使い分けている。

```css
.markdown-content {
  font-size: var(--font-size-prose);      /* 16px */
  line-height: var(--line-height-loose);  /* 1.75 */
}

.markdown-content pre code {
  font-size: var(--font-size-base);       /* 14px */
  line-height: var(--line-height-base);   /* 1.5 */
}
```

**旧トークンの廃止**:
- `--font-size-xs` (11px) — 28箇所を sm/base に振り分け。情報密度は color + font-weight で表現
- `--font-size-md` (14px) — base に統合
- ハードコード 10px — sm (12px) に統一 (WCAG 最小サイズ確保)

### 6.2 スペーシングスケール

4px グリッドを rem で表現する。
4px グリッドに乗らないハードコード値 (1px, 2px, 3px, 5px, 6px) は
最も近い 4px 倍数に丸める。

```css
--space-1: 0.25rem;   /*  4px */
--space-2: 0.5rem;    /*  8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-5: 1.5rem;    /* 24px */
--space-6: 2rem;      /* 32px */
--space-8: 3rem;      /* 48px */
```

### 6.3 line-height スケール

無単位の比率で統一する。font-size が変わっても比率を維持する。
`line-height: 1` (アセンダー/ディセンダー切れのリスク) は 1.25 に変更する。

```css
--line-height-tight: 1.25;  /* ボタン, バッジ, 単行要素 */
--line-height-base:  1.5;   /* 本文, コメント, UI テキスト */
--line-height-loose: 1.75;  /* Markdown 本文 (長文の可読性) */
```

### 6.4 border-radius スケール

旧 `--radius-md: 6px` は 4px グリッドに乗っていなかったため 8px に変更する。

```css
--radius-sm: 0.25rem;  /*  4px — ボタン, バッジ, インライン要素 */
--radius-md: 0.5rem;   /*  8px — カード, パネル, 入力フォーム */
--radius-lg: 0.75rem;  /* 12px — モーダル, 大きなコンテナ */
```

### 6.5 インタラクティブ要素の最小サイズ

WCAG 2.5.8 (Target Size) に準拠し、最小 24×24px を確保する。

```css
--interactive-min: 1.5rem;         /* 24px — 最小タッチ/クリックターゲット */
--interactive-comfortable: 2rem;   /* 32px — 推奨タッチターゲット */
```

```css
button, [role="button"], a, input, select, textarea {
  min-height: var(--interactive-min);
  min-width: var(--interactive-min);
}
```

### 6.6 tokens.css

```css
/* tokens.css — Tasuki Design Tokens */
:root {
  /* ── Color ── */
  /* (既存のカラートークンは変更なし — 省略) */

  /* ── Typography ── */
  --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans",
    Helvetica, Arial, sans-serif;
  --font-mono: "SF Mono", "Fira Code", "Fira Mono", "Roboto Mono", Menlo,
    Consolas, monospace;

  --font-size-sm:    0.75rem;   /* 12px — メタデータ, 補助テキスト */
  --font-size-base:  0.875rem;  /* 14px — UI テキスト, diff, コード */
  --font-size-prose: 1rem;      /* 16px — Markdown 本文 (日本語可読性) */
  --font-size-lg:    1rem;      /* 16px — セクション見出し */
  --font-size-xl:    1.25rem;   /* 20px — ページタイトル */

  --line-height-tight: 1.25;
  --line-height-base:  1.5;
  --line-height-loose: 1.75;

  --font-weight-normal:   400;
  --font-weight-medium:   500;
  --font-weight-semibold: 600;

  /* ── Spacing (4px grid) ── */
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
  --sidebar-width: 260px;
  --toolbar-height: 3rem;       /* 48px */
  --interactive-min: 1.5rem;    /* 24px */
  --interactive-comfortable: 2rem; /* 32px */

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

### 6.7 マイグレーション影響

```
変更前                    変更後                    影響
─────────────────────────────────────────────────────────────────
--font-size-xs: 11px      廃止                     28箇所を sm/base に振り分け
--font-size-sm: 12px      0.75rem (12px)           値は同じ、単位だけ変更
--font-size-base: 13px    0.875rem (14px)          ← 1px 大きくなる (3箇所のみ)
--font-size-md: 14px      廃止 (base に統合)       4箇所を base に変更
--font-size-lg: 16px      1rem (16px)              値は同じ、単位だけ変更
(なし)                    --font-size-prose: 1rem  新規追加 (Markdown 本文用)
(なし)                    --font-size-xl: 1.25rem  新規追加 (20px, 24px の統一先)
ハードコード 10px ×4      sm (0.75rem) に統一      可読性向上
ハードコード 12px ×3      sm (0.75rem) に統一      トークン使用
--radius-md: 6px          0.5rem (8px)             2px 大きくなる
line-height: 1 ×3         1.25                     テキスト切れ防止
line-height: 20px ×1      --line-height-base       比率化
```

### 6.8 CSS アーキテクチャ [M2]

CSS Modules でコンポーネント単位にスコープする。

```
src/styles/
  ├─ tokens.css        CSS 変数定義 (上記の全トークン)
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

## 7. アクセシビリティ [H3]

### 7.1 キーボードナビゲーション

```
Tab 順序:
  Toolbar → Sidebar → Main Content

Toolbar 内:
  Tab / Shift+Tab でボタン間移動
  Enter / Space でアクティベート

Sidebar 内:
  ↑↓ でファイル/ドキュメント間移動
  ←→ でツリー展開/折りたたみ
  Enter でファイル選択
  / でフィルタ入力にフォーカス

Diff 内:
  j/k で変更ファイル間移動
  n/N で次/前の差分ハンクへジャンプ
  c でコメントフォーム開始
  Escape でコメントフォーム閉じ

Review Panel 内:
  ↑↓ でコメント間移動
  Enter で解決フォーム開始
  Escape でフォーム閉じ
```

### 7.2 ARIA 属性

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

## 8. Terminal [M5]

### 8.1 TerminalManager

XTerm インスタンスのライフサイクルを管理するクラス。
DOM reparenting を排除し、React の正規のツリー構造を維持する。

```tsx
class TerminalManager {
  private term: XTerm | null = null;
  private spawned = false;

  async init(container: HTMLElement): Promise<void> {
    if (this.term) {
      this.term.open(container);
      this.fit();
      return;
    }
    this.term = new XTerm({ /* ... */ });
    this.term.open(container);
    await this.spawn();
  }

  detach(): void {
    // コンテナからの切り離し (インスタンスは破棄しない)
  }

  dispose(): void {
    this.term?.dispose();
    this.term = null;
  }
}
```

### 8.2 React 統合

```tsx
const TerminalPane = React.lazy(() => import("./TerminalPane"));

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

Terminal の色は CSS 変数で定義し、JS 内ハードコードを廃止する [M5]。

---

## 9. エラーハンドリング・ローディング [H7, M4]

### 9.1 非同期状態管理フック

```tsx
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

### 9.2 スケルトンローディング

```tsx
function MarkdownSkeleton() {
  return (
    <div className={styles.skeleton}>
      <div className={styles.skeletonTitle} />
      <div className={styles.skeletonLine} />
      <div className={styles.skeletonLine} />
      <div className={styles.skeletonShort} />
      <div className={styles.skeletonLine} />
    </div>
  );
}
```

---

## 10. コンポーネントツリー全体像

```
App
 ├─ hooks: useInitialize()
 │
 └─ TerminalManagerProvider
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
                               │                           │         └─ ThreadFooter
                               │                           ├─ ResolvedSection (<details>)
                               │                           │    └─ ResolvedThreadCard × N
                               │                           └─ VerdictBar
                               │
                               └─ [viewer] ViewerLayout (ResizablePane)
                                            ├─ MarkdownViewer (左)
                                            └─ Suspense
                                                 └─ TerminalPane (lazy, 右)
```

---

## 11. 再描画フロー

### スレッド作成時

```
addThread("src/App.tsx", rootComment)
  → reviewStore.threads.get("src/App.tsx") のみ新しい参照に
  → DiffFileView("src/App.tsx") のみ再描画
  → ReviewPanel 再描画
  → Sidebar バッジ最小限更新
  合計: 3 コンポーネント再描画
```

### 返信追加時

```
addReply(threadId, replyBody)
  → 該当スレッドの replies のみ更新
  → ThreadCard (該当スレッド1つ) のみ再描画
  → DiffFileView は再描画されない
  合計: 1 コンポーネント再描画
```

### スレッド解決時

```
resolveThread(threadId)
  → thread.resolved = true (ワンクリック)
  → ThreadCard が UnresolvedSection → ResolvedSection へ移動
  → VerdictBar の unresolvedCount 更新
  合計: 2 コンポーネント再描画
```

### モード切替時

```
setDisplayMode("split")
  → LayoutSwitch が DiffLayout をアンマウント、SplitLayout をマウント
  → RightTabbedPane 初回マウント (Suspense で lazy load)
  → Terminal は TerminalManagerProvider が状態保持、再アタッチ
```

---

## 12. マイグレーション戦略

段階的に移行する。各 Phase は独立してリリース可能。

```
Phase 1 — レビュー体験改善 (既存構造で実施可能)
  ├─ reviewStore をスレッドモデルに変更 (Map<string, Thread[]>)
  ├─ DiffViewer にファイル単位の selector を適用
  ├─ ResolveMemoForm 廃止 → ThreadFooter (reply + resolve) に置換
  ├─ 返信機能の追加 (フラット, 孫なし)
  └─ 右ペインタブを sticky に修正

Phase 2 — Store 分離
  ├─ diffStore → diffStore + docStore + editorStore に分割
  ├─ LeftPaneMode → rightPaneMode に改名
  └─ 検索状態を editorStore に移動

Phase 3 — レイアウト再設計
  ├─ MainContent → LayoutSwitch + 3つのレイアウトコンポーネント
  ├─ Terminal を React.lazy + TerminalManager に移行
  └─ split-right の常時マウントを排除

Phase 4 — CSS + アクセシビリティ
  ├─ CSS Modules 移行
  ├─ rem ベースのデザイントークン適用
  ├─ ARIA 属性の追加
  ├─ キーボードナビゲーション実装
  └─ リサイズハンドルのヒットエリア拡大

Phase 5 — 仮想化 + パフォーマンス
  ├─ サイドバーの仮想化 (react-window)
  ├─ サイドバー検索/フィルタ
  └─ DiffList の仮想化 (大規模 changeset 対応)
```
