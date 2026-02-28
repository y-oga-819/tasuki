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
                                     │ reviewStore      │  ほぼ現状維持
                                     │  comments        │  ← Map<fileId, Comment[]> に変更
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

### コメントの正規化 (C1 解決)

```typescript
// 現状: 全コメントを1つの配列で管理
comments: ReviewComment[]

// 提案: ファイルパスでインデックス化した Map
comments: Map<string, ReviewComment[]>
// ├─ "src/App.tsx" → [comment1, comment2]
// └─ "src/store/diffStore.ts" → [comment3]

// DiffViewer は自分のファイルのコメントだけを購読:
const fileComments = useReviewStore(
  (s) => s.comments.get(filePath) ?? EMPTY_ARRAY
);
// → 他ファイルのコメント変更で再描画されない
```

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

## 5. ReviewPanel 再設計 (C2 解決)

### 現状の問題

```
全コメントに ResolveMemoForm が同時表示される
→ 10件のコメントがあると10個のフォームが並ぶ
```

### 提案: Progressive Disclosure

```
┌─ ReviewPanel ────────────────────────────────┐
│ Review Comments (5)          [Copy All]       │
├──────────────────────────────────────────────┤
│                                              │
│ src/App.tsx:L42                         ✓ ✕  │  ← ✓ クリックで解決フォーム開く
│ > const result = await fetch(url);           │
│ エラーハンドリングが不足しています             │
│                                              │
│ src/App.tsx:L55-L60                    ✓ ✕  │
│ > function processData(input: any) {         │
│ any型を避けてください                        │
│ ┌─ 解決メモ ──────────────────────────┐      │  ← ✓ クリック後のみ表示
│ │ 型を追加しました                     │      │
│ │                    [確定] [取消]     │      │
│ └─────────────────────────────────────┘      │
│                                              │
│ ──── 解決済み (3) ────────────────────────── │  ← 折りたたみ可能セクション
│ ✓ src/store/index.ts:L12          ↩ ✕       │
│   型エクスポートを修正                        │
│                                              │
├──────────────────────────────────────────────┤
│ 未解決: 2件                                   │
│                        [Approve] [Reject]    │
└──────────────────────────────────────────────┘
```

**変更点**:

1. **解決フォームはクリック時のみ展開** (1件ずつ、排他的)
2. **解決済みコメントは折りたたみセクション**に分離 (デフォルト折りたたみ)
3. **未解決→解決済みの移動時にアニメーション**で文脈を維持

```tsx
const [resolvingId, setResolvingId] = useState<string | null>(null);

// ✓ ボタンクリック → フォーム表示
<button onClick={() => setResolvingId(c.id)}>✓</button>

// フォームは resolvingId が一致する1件だけ
{resolvingId === c.id && (
  <ResolveMemoForm
    onConfirm={(memo) => { resolveComment(c.id, memo); setResolvingId(null); }}
    onCancel={() => setResolvingId(null)}
  />
)}
```

---

## 6. CSS アーキテクチャ再設計

### 現状 → 提案

```
現状                              提案
src/styles/index.css (2000行)     src/styles/
                                   ├─ tokens.css        CSS変数定義 (色, 間隔, フォント)
                                   ├─ reset.css         リセット + ベーススタイル
                                   ├─ global.css        app, body のレイアウト
                                   └─ (各コンポーネントに *.module.css)

                                  src/components/
                                   ├─ Toolbar/
                                   │    ├─ Toolbar.tsx
                                   │    └─ Toolbar.module.css
                                   ├─ Sidebar/
                                   │    ├─ Sidebar.tsx
                                   │    └─ Sidebar.module.css
                                   ...
```

### 主な改善

```css
/* tokens.css */
:root {
  /* rem ベースに変更 (アクセシビリティ) */
  --font-size-sm: 0.75rem;   /* 12px → 0.75rem */
  --font-size-base: 0.875rem; /* 14px → 0.875rem */

  /* z-index レイヤーを体系化 */
  --z-base: 0;
  --z-sticky: 10;
  --z-dropdown: 100;
  --z-overlay: 500;
  --z-modal: 1000;

  /* リサイズハンドルのヒットエリア */
  --resize-handle-width: 4px;
  --resize-handle-hitarea: 12px;  /* 実際のクリック範囲 */
}
```

```css
/* ResizeHandle.module.css */
.handle {
  width: var(--resize-handle-width);
  position: relative;
  cursor: col-resize;
}

/* 透明な拡大ヒットエリア */
.handle::before {
  content: "";
  position: absolute;
  inset: 0 calc(-1 * (var(--resize-handle-hitarea) - var(--resize-handle-width)) / 2);
}
```

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
                               │                           │    └─ CommentCard × N
                               │                           ├─ ResolvedSection (collapsible)
                               │                           └─ VerdictBar
                               │
                               └─ [viewer] ViewerLayout (ResizablePane)
                                            ├─ MarkdownViewer (左)
                                            └─ Suspense
                                                 └─ TerminalPane (lazy, 右)
```

---

## 11. 再描画フロー比較

### コメント追加時

```
現状:
  addComment()
  → reviewStore.comments 配列が新しい参照に
  → FileSidebar 再描画 (badge計算)
  → DiffViewer × 50 全て再描画 (fileComments フィルタ再実行)
  → ReviewPanel 再描画
  合計: 52 コンポーネント再描画

提案:
  addComment("src/App.tsx", comment)
  → reviewStore.comments.get("src/App.tsx") のみ新しい参照に
  → DiffFileView("src/App.tsx") のみ再描画 (selector が一致)
  → ReviewPanel 再描画 (コメント一覧更新)
  → Sidebar のバッジは useSyncExternalStore で最小限更新
  合計: 3 コンポーネント再描画
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
  ├─ reviewStore のコメントを Map<string, Comment[]> に変更
  ├─ DiffViewer にファイル単位の selector を適用
  ├─ ResolveMemoForm を1件ずつ表示に変更
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
