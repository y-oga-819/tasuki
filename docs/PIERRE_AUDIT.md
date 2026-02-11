# Pierre 機能監査: tasuki における利用状況と改善機会

> 作成日: 2026-02-11
>
> Pierre (`@pierre/diffs` v1.0.10) の全機能を洗い出し、tasuki の現在の利用状況を監査した結果をまとめる。

## 1. Pierre の全体機能マップ

### 1.1 React コンポーネント

| コンポーネント | 説明 |
|---|---|
| `MultiFileDiff` | 2 つの `FileContents` からdiffを描画。ファイル全文が手元にある場合の推奨パス |
| `PatchDiff` | unified patch 文字列からdiffを描画。パッチしかない場合のフォールバック |
| `FileDiff` | `FileDiffMetadata` を直接受け取る低レベルAPI。パース済みデータがある場合に使用 |
| `File` | diff 無しの単一ファイル表示。シンタックスハイライト付き |
| `Virtualizer` | 巨大ファイルの仮想スクロール。子コンポーネントをラップして使用 |
| `WorkerPoolContextProvider` | Shiki ハイライトの Web Worker プール管理 |

### 1.2 マネージャー（内部ユーティリティ、直接利用可）

| マネージャー | 機能 |
|---|---|
| `ScrollSyncManager` | split view で左右パネルの水平スクロールを同期 |
| `LineSelectionManager` | 行選択の高度な状態管理 |
| `MouseEventManager` | 行・行番号クリックなどのマウスイベント処理 |
| `ResizeManager` | リサイズ監視・レイアウト再計算 |
| `UniversalRenderingManager` | クロスプラットフォーム描画制御 |

### 1.3 SSR サポート

| 関数 | 説明 |
|---|---|
| `preloadDiffs()` | diff のプリレンダリング HTML を生成 |
| `preloadFile()` | ファイルのプリレンダリング HTML を生成 |
| `preloadPatchFile()` | パッチのプリレンダリング HTML を生成 |
| `renderHTML()` | HAST AST → HTML 文字列変換 |

### 1.4 テーマ・ハイライター

| 関数 | 説明 |
|---|---|
| `registerCustomLanguage()` | カスタム言語のシンタックスハイライト登録 |
| `registerCustomTheme()` | カスタムカラーテーマ定義 |
| `registerCustomCSSVariableTheme()` | CSS 変数ベースのテーマ定義 |
| `resolveLanguage()` / `resolveTheme()` | 言語・テーマの解決 |
| `getFiletypeFromFileName()` | ファイル名から言語を推定 |
| `cleanLastNewline()` | 末尾改行の正規化 |

### 1.5 `FileDiffOptions` — 全プロパティ

基底型 `BaseCodeOptions` と拡張型 `BaseDiffOptions` を合わせた全設定項目:

#### 表示設定

| プロパティ | 型 | デフォルト | 説明 |
|---|---|---|---|
| `diffStyle` | `'unified' \| 'split'` | `'split'` | diff レイアウト |
| `diffIndicators` | `'classic' \| 'bars' \| 'none'` | `'bars'` | 変更行のインジケーター表示方式 |
| `lineDiffType` | `'word-alt' \| 'word' \| 'char' \| 'none'` | `'word-alt'` | インライン差分のハイライト粒度 |
| `overflow` | `'scroll' \| 'wrap'` | `'scroll'` | 長い行の処理 |
| `hunkSeparators` | `'simple' \| 'metadata' \| 'line-info' \| 'line-info-basic' \| 'custom'` | `'line-info'` | hunk 間セパレーターの表示形式 |
| `expandUnchanged` | `boolean` | `false` | 変更なしの行を展開表示するか |
| `collapsedContextThreshold` | `number` | `2` | 自動折りたたみの閾値 |
| `expansionLineCount` | `number` | `100` | 1 回のクリックで展開する行数 |
| `maxLineDiffLength` | `number` | `1000` | 文字レベル差分の最大行長 |
| `disableBackground` | `boolean` | — | 変更行の背景色を無効化 |

#### テーマ

| プロパティ | 型 | デフォルト | 説明 |
|---|---|---|---|
| `theme` | `DiffsThemeNames \| { dark: ..., light: ... }` | — | Shiki テーマ。Pierre 独自テーマ `'pierre-dark'`, `'pierre-light'` も利用可 |
| `themeType` | `'system' \| 'light' \| 'dark'` | `'system'` | テーマモード。`'system'` は `prefers-color-scheme` に自動追従 |
| `preferredHighlighter` | `'shiki-js' \| 'shiki-wasm'` | — | Shiki 実装の選択 |
| `useCSSClasses` | `boolean` | — | インラインスタイルの代わりに CSS クラスを使用 |

#### レイアウト制御

| プロパティ | 型 | 説明 |
|---|---|---|
| `disableLineNumbers` | `boolean` | 行番号カラムを非表示 |
| `disableFileHeader` | `boolean` | ファイルヘッダーを非表示 |
| `disableVirtualizationBuffers` | `boolean` | 仮想化バッファを無効化 |
| `tokenizeMaxLineLength` | `number` | シンタックスハイライトの最大行長 |
| `unsafeCSS` | `string` | カスタム CSS の直接注入 |

#### インタラクション

| プロパティ | 型 | 説明 |
|---|---|---|
| `enableLineSelection` | `boolean` | 行選択の有効化 |
| `onLineSelected` | callback | 行選択時のコールバック |
| `onLineNumberClick` | callback | 行番号クリック時のコールバック |
| `enableHoverUtility` | `boolean` | ホバー時のユーティリティ表示 |

#### レンダリングカスタマイズ

| プロパティ | 型 | 説明 |
|---|---|---|
| `renderHeaderMetadata` | callback | ファイルヘッダーにカスタムコンテンツを注入 |
| `renderAnnotation` | callback | アノテーションのカスタムレンダリング |
| `renderHoverUtility` | callback | ホバーユーティリティのカスタムレンダリング |
| `lineAnnotations` | `DiffLineAnnotation[]` | 行アノテーションデータ |
| `selectedLines` | `SelectedLineRange` | プログラムによる行選択の制御 |
| `prerenderedHTML` | `string` | プリレンダリング済み HTML の注入 |
| `metrics` | `VirtualFileMetrics` | 仮想化パフォーマンスのメトリクス設定 |

### 1.6 CSS カスタムプロパティ（主要なもの）

```css
/* タイポグラフィ */
--diffs-font-size: 13px;
--diffs-line-height: 20px;
--diffs-font-family: ...;
--diffs-header-font-family: ...;
--diffs-font-features: ...;
--diffs-tab-size: 2;

/* カラー */
--diffs-bg / --diffs-fg
--diffs-deletion-color / --diffs-addition-color / --diffs-modified-color
--diffs-bg-deletion / --diffs-bg-addition
--diffs-bg-deletion-emphasis / --diffs-bg-addition-emphasis  /* インライン差分 */
--diffs-bg-selection / --diffs-selection-base

/* レイアウト */
--diffs-gap-inline / --diffs-gap-block
--diffs-min-number-column-width-default: 3ch;
--diffs-annotation-min-height
```

### 1.7 データ属性セレクター（スタイリング用）

```css
[data-diff-type='split']  /* split ビュー固有のスタイル */
[data-overflow='wrap']    /* wrap モード時のスタイル */
[data-indicators='bars']  /* bars インジケーター時 */
[data-line-type='change-addition']  /* 追加行 */
[data-line-type='change-deletion']  /* 削除行 */
[data-diffs-header]       /* ファイルヘッダー */
[data-hovered]            /* ホバー状態 */
```

---

## 2. tasuki の現在の Pierre 利用状況

### 2.1 使用中のインポート

```typescript
// App.tsx
import { WorkerPoolContextProvider } from "@pierre/diffs/react";

// DiffViewer.tsx
import { MultiFileDiff, PatchDiff } from "@pierre/diffs/react";
import type { DiffLineAnnotation, RenderHeaderMetadataProps } from "@pierre/diffs/react";
import type { SelectedLineRange, AnnotationSide, FileContents, FileDiffOptions } from "@pierre/diffs";
import { getFiletypeFromFileName, cleanLastNewline } from "@pierre/diffs";

// store/index.ts
import type { SelectedLineRange } from "@pierre/diffs";

// utils/diff-utils.ts
import { cleanLastNewline } from "@pierre/diffs";
```

### 2.2 使用中のオプション設定

```typescript
// DiffViewer.tsx:260-276
const options = useMemo<FileDiffOptions<AnnotationMeta>>(() => ({
  diffStyle,                    // ✅ 使用中（'split' | 'unified'）
  theme: { dark: "github-dark", light: "github-light" },  // ✅ 使用中
  themeType: "dark",            // ✅ 使用中（固定値）
  enableLineSelection: true,    // ✅ 使用中
  onLineSelected: ...,          // ✅ 使用中
  onLineNumberClick: ...,       // ✅ 使用中
  enableHoverUtility: true,     // ✅ 使用中
  expandUnchanged: true,        // ✅ 使用中
  diffIndicators: "classic",    // ✅ 使用中（Pierre デフォルトは 'bars'）
  lineDiffType: "word",         // ✅ 使用中（Pierre デフォルトは 'word-alt'）
  overflow: "scroll",           // ✅ 使用中
  hunkSeparators: "line-info",  // ✅ 使用中
}), [...]);
```

### 2.3 利用率サマリー

| カテゴリ | 利用数 / 全体 | 利用率 |
|---|---|---|
| React コンポーネント | 3 / 6 | 50% |
| マネージャー | 0 / 5 | 0% |
| SSR 関数 | 0 / 4 | 0% |
| ユーティリティ関数 | 2 / 60+ | ~3% |
| `FileDiffOptions` フィールド | 12 / 25+ | ~48% |
| CSS カスタムプロパティ | 0 / 40+ | 0% |

---

## 3. 独自実装で Pierre を橋渡ししている箇所

### 3.1 `generateGitPatch()` — 独自データ構造 → Pierre patch 文字列変換

**場所**: `src/utils/diff-utils.ts:80-115`

```
Rust Backend → DiffResult (独自型) → generateGitPatch() → patch string → PatchDiff
```

tasuki の Rust バックエンドは `DiffResult > FileDiff > DiffHunk > DiffLine` という独自の型階層で diff データを返す。Pierre の `PatchDiff` は unified patch 文字列を受け取るため、`generateGitPatch()` が git format の patch を手動で組み立てている。

`MultiFileDiff` パス（`old_content`/`new_content` がある場合）では不要だが、フォールバック時にのみ発動する。

**妥当性**: Pierreは `parsePatchFiles()` を内部で使ってパッチをパースし直すため、tasuki側で手動フォーマットしたものを再パースする二重処理になっている。ただし `MultiFileDiff` が使えないケースの保険として必要。

### 3.2 `DiffLayout` の独自命名

**場所**: `src/store/index.ts` の型定義、`src/components/DiffViewer.tsx:48`

```typescript
// tasuki
type DiffLayout = "split" | "stacked";

// Pierre
type DiffStyle = "split" | "unified";

// ブリッジ
const diffStyle = diffLayout === "split" ? "split" : "unified";
```

Pierre の用語では `"unified"` だが、tasuki は `"stacked"` という独自名を使用。UI 上の表現としては `"stacked"` の方が直感的だが、コード内では Pierre との変換が必要になる。

### 3.3 ファイル折りたたみの完全独自実装

**場所**: `src/components/DiffViewer.tsx:289-311`, `src/store/index.ts:44-46,101-111`

Pierre にはファイル単位の折りたたみ機能がないため、tasuki は:
1. `collapsedFiles: Set<string>` を Zustand ストアで管理
2. 折りたたみ時は Pierre コンポーネントをレンダリングせず独自 HTML を表示
3. ヘッダーに折りたたみボタンを `renderHeaderMetadata` で注入

**妥当性**: Pierre が提供していない機能のため独自実装は妥当。

### 3.4 `getCodeSnippet()` — コメント用コード抽出

**場所**: `src/utils/diff-utils.ts:5-28`

Pierre はレンダリングに特化しており、特定行範囲のテキストをプログラムで取得する API を提供していない。tasuki は `FileDiff.new_content` や hunk データから直接テキストを切り出す。

**妥当性**: Pierre の責務範囲外のため独自実装は妥当。

### 3.5 `selectedLines` の二重管理

**場所**: `src/components/DiffViewer.tsx:247-257`

```typescript
const selectedLines = useMemo(() => {
  if (commentFormTarget?.filePath === filePath) {
    return {
      start: commentFormTarget.selectionStart,
      end: commentFormTarget.selectionEnd,
      side: commentFormTarget.side,
    } satisfies SelectedLineRange;
  }
  return selectedLineRange;
}, [selectedLineRange, commentFormTarget, filePath]);
```

コメントフォーム表示中はtasuki側の `commentFormTarget` から選択範囲を合成し、Pierre の `selectedLines` prop に渡す。通常時は Pierre ネイティヴの `selectedLineRange` をそのまま渡す。

**妥当性**: Pierre のアノテーション表示位置とは別に「選択中の行」を視覚的に保持したい tasuki 固有の要件。

---

## 4. 未使用だが UX/UI 改善に活かせそうな Pierre 機能

### 4.1 `themeType: 'system'` — OS のダーク/ライト自動追従

**現状**: `themeType: "dark"` で固定

**改善**: `'system'` に変更すると `prefers-color-scheme` メディアクエリに自動追従する。tasuki 全体でライトモード対応する場合に diff 表示も自動連動。ダークモード固定のままでも、将来のテーマ対応への布石として `'system'` にしておくとコストゼロで移行できる。

**影響範囲**: `DiffViewer.tsx` 1行変更

### 4.2 `lineDiffType: 'word-alt'` — 改良版 word diff

**現状**: `'word'` を指定

**改善**: Pierre のデフォルトは `'word-alt'` で、`'word'` の改良版アルゴリズム。特にリファクタリング系の diff（変数名変更、引数順序変更など）でハイライト精度が向上する。

**影響範囲**: `DiffViewer.tsx` 1行変更

### 4.3 `overflow: 'wrap'` トグル — 長い行の折り返し切替

**現状**: `'scroll'` 固定

**改善**: Toolbar にトグルを追加し `'scroll'` ↔ `'wrap'` を切り替え可能にする。特に:
- Markdown / JSON / YAML など長い行が多いファイルのレビュー
- `diff-docs` モードで横幅が限られる場面

で横スクロール不要になり視認性が向上する。

**影響範囲**: `store/index.ts` にステート追加、`Toolbar.tsx` に UI 追加、`DiffViewer.tsx` でオプション参照

### 4.4 `expandUnchanged: false` + `collapsedContextThreshold` / `expansionLineCount` — Hunk 展開制御

**現状**: `expandUnchanged: true` で変更なしの行もすべて展開

**改善**: 大きなファイル（数百〜数千行）のレビュー時、変更箇所に集中できるよう:
1. `expandUnchanged: false` にして、変更箇所周辺のコンテキストのみ表示
2. `collapsedContextThreshold` で折りたたみの閾値を制御（デフォルト 2）
3. `expansionLineCount` で「もっと見る」クリック時の展開行数を制御（デフォルト 100）
4. Toolbar にトグルを追加して `expandUnchanged` を切り替え可能に

Pierre がネイティヴに hunk 間のセパレーター（クリックで展開）を描画してくれるため、独自 UI は不要。

**影響範囲**: `DiffViewer.tsx` のオプション変更、Toolbar にトグル追加

### 4.5 `diffIndicators: 'bars'` — モダンなバー型インジケーター

**現状**: `'classic'`（`+`/`-` 記号）

**改善**: Pierre のデフォルトは `'bars'`（行左端のカラーバー）。GitHub UI に近い見た目で、モダンな GUI アプリとしての統一感が出る。好みの問題もあるため、Toolbar で切り替え可能にするのも一案。

**影響範囲**: `DiffViewer.tsx` 1行変更

### 4.6 `Virtualizer` — 巨大 diff のパフォーマンス最適化

**現状**: 未使用（全行を DOM にレンダリング）

**改善**: `Virtualizer` で `MultiFileDiff` をラップすると仮想スクロールが有効になり:
- 1 万行超の diff でも 60fps でスクロール
- lock ファイルや自動生成コードの大量 diff で DOM ノードが爆発しない
- メモリ使用量の削減

```tsx
<Virtualizer>
  <MultiFileDiff oldFile={old} newFile={new} {...props} />
</Virtualizer>
```

**影響範囲**: `DiffViewer.tsx` でラップ追加。折りたたみとの組み合わせに注意が必要。

### 4.7 CSS カスタムプロパティによるスタイリング統一

**現状**: Pierre のデフォルトスタイルをそのまま使用

**改善**: tasuki のデザインシステム（CSS 変数）と Pierre の CSS 変数を連携:

```css
/* tasuki の styles/index.css に追加 */
:root {
  --diffs-font-family: var(--tasuki-code-font);  /* フォント統一 */
  --diffs-font-size: 13px;
  --diffs-line-height: 1.6;
  --diffs-tab-size: 4;                           /* プロジェクト規約に合わせる */
  --diffs-gap-inline: 12px;                      /* split view のギャップ */
}
```

特に `--diffs-font-family` で tasuki 全体のコードフォントと diff 表示のフォントを統一するだけで視覚的一貫性が向上する。

**影響範囲**: CSS ファイルのみ

### 4.8 `File` コンポーネント — 新規ファイルの単一ファイル表示

**現状**: 新規ファイル（status: `"added"`）も diff として表示（全行が `+` 表示）

**改善**: 新規ファイルの場合は Pierre の `File` コンポーネントで通常のファイルビューとして描画する方が読みやすい。全行が緑色の `+` で始まるよりも、普通のシンタックスハイライトされたコードの方がレビュー時の可読性が高い。

```tsx
if (fileDiff.file.status === "added" && newFile) {
  return <File file={newFile} options={fileOptions} />;
}
```

**影響範囲**: `DiffViewer.tsx` に条件分岐追加

### 4.9 `DiffLayout` 命名の Pierre 用語への統一

**現状**: tasuki は `"stacked"` という独自名を使い、Pierre の `"unified"` にマッピング

**改善**: 内部的には Pierre の用語 `"unified"` / `"split"` を使い、UI 表示ラベルだけを日本語化または別名にする:

```typescript
// store
type DiffLayout = "split" | "unified";  // Pierre の用語に合わせる

// Toolbar の表示ラベル
const layoutLabels = { split: "Split", unified: "Unified" };
```

ブリッジコードが不要になり、Pierre のドキュメントとの対応が明確になる。

**影響範囲**: `types/index.ts`, `store/index.ts`, `Toolbar.tsx`, `DiffViewer.tsx`

### 4.10 `hunkSeparators` のバリエーション活用

**現状**: `'line-info'` 固定

**改善**: `'metadata'` を使うと hunk ヘッダーの関数名コンテキスト（`@@ -1,3 +1,4 @@ function foo` の `function foo` 部分）をより目立つ形で表示できる。コードレビュー時に「この変更がどの関数の中か」が一目でわかる。

**影響範囲**: `DiffViewer.tsx` 1行変更

---

## 5. 対応優先度

### Tier 1: 即座に適用可能（1行〜数行の変更）

| # | 項目 | 工数 | 期待効果 |
|---|---|---|---|
| 4.2 | `lineDiffType: 'word-alt'` | 1行 | インライン差分ハイライトの品質向上 |
| 4.1 | `themeType: 'system'` | 1行 | OS テーマ自動追従への準備 |
| 4.5 | `diffIndicators: 'bars'` | 1行 | モダンなUI表現（好みで選択） |
| 4.9 | `DiffLayout` 命名統一 | 4ファイル | ブリッジコード削減、保守性向上 |
| 4.10 | `hunkSeparators: 'metadata'` | 1行 | 関数コンテキストの視認性向上 |

### Tier 2: 小規模な機能追加

| # | 項目 | 工数 | 期待効果 |
|---|---|---|---|
| 4.7 | CSS カスタムプロパティ | CSS のみ | デザイン統一感の大幅向上 |
| 4.3 | `overflow: 'wrap'` トグル | 3ファイル | 長い行のレビュー体験改善 |
| 4.8 | 新規ファイルの `File` 表示 | 1ファイル | 新規ファイルの可読性向上 |
| 4.4 | Hunk 展開制御 | 2ファイル | 大規模 diff のフォーカス改善 |

### Tier 3: 中規模な改善

| # | 項目 | 工数 | 期待効果 |
|---|---|---|---|
| 4.6 | `Virtualizer` 導入 | 要検証 | 巨大 diff のパフォーマンス改善 |
