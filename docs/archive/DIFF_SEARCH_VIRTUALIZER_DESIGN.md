# データレベル検索 + Virtualizer 設計書

> 作成日: 2026-02-23
>
> 目的: 大規模 diff でも全行を漏れなく検索できる機構を、Pierre の Virtualizer と両立させる設計を定める。

## 1. 背景と問題

### 1.1 現行の検索実装（DiffSearchBar.tsx）

現在の検索は **DOM ベース**:

```
Cmd+F → DiffSearchBar 表示
       → collectTextNodes(scrollContainer)  // Shadow DOM 含む全テキストノード走査
       → String.indexOf() でマッチ
       → CSS Highlights API でハイライト描画
       → Range.getBoundingClientRect() でスクロール
```

**前提**: Pierre が全行を DOM にレンダリングしている → 全テキストノードが走査可能。

### 1.2 Virtualizer 導入時に生じる問題

Pierre の `Virtualizer` を導入すると、**画面外の行は DOM に存在しない**可能性がある。

- `collectTextNodes()` が画面外の行を見つけられない
- マッチ数が不正確（スクロール位置によって変動）
- ナビゲーション（次/前）が画面外のマッチに到達できない

### 1.3 ゴール

Virtualizer の有無に関わらず:

1. **全行の完全な検索結果**を返す（マッチ数が正確）
2. **全マッチをナビゲーション**できる（次/前で画面外のマッチにもジャンプ）
3. **マッチ箇所を文字レベルでハイライト**できる

---

## 2. Pierre API の制約

### 2.1 Virtualizer

| 機能 | 状態 |
|---|---|
| `scrollToLine()` / `scrollToItem()` | **なし** — プログラムによるスクロール API 非公開 |
| visible range コールバック | **なし** — 表示中の行範囲を取得する手段なし |
| `onScroll` コールバック | **なし** — 公開 API としては非公開 |
| forwardRef / imperative handle | **なし** |
| `disableVirtualizationBuffers` | **あり** — 仮想化バッファの無効化オプション |

**結論**: Virtualizer はラップするだけで有効化されるが、外部から制御する API が限定的。スクロール制御は DOM 操作 (`scrollIntoView`) に頼る。

### 2.2 ハイライト手段

| 手段 | 文字レベル | 複数マッチ同時 | Shadow DOM 内 | 評価 |
|---|---|---|---|---|
| CSS Highlights API | **可** | **可** | **可** (adoptedStyleSheets) | **最適** |
| `lineAnnotations` + `renderAnnotation` | 不可（ブロック要素のみ） | 可 | Pierre が管理 | 行マーカー用途のみ |
| `selectedLines` | 不可（行全体のみ） | 不可（1範囲のみ） | Pierre が管理 | current match 補助用 |
| `unsafeCSS` | 不可 | — | Pierre が管理 | 静的スタイルのみ |

**結論**: 文字レベルの複数マッチハイライトは **CSS Highlights API 一択**。

### 2.3 スクロール制御

Pierre は `scrollToLine` を公開していないため:

```typescript
// 親コンテナ内のファイル要素を特定し、scrollIntoView で移動
const fileEl = container.querySelector(`[data-file-path="${CSS.escape(filePath)}"]`);
fileEl?.scrollIntoView({ behavior: "smooth", block: "start" });
```

hunk が折りたたまれている場合は `fileDiff.expandHunk(hunkIndex, direction)` で事前展開が必要だが、
`FileDiff` インスタンスへのアクセスは React コンポーネント経由では困難（ref 非公開）。

---

## 3. 利用可能なデータ

Zustand ストアの `diffResult: DiffResult` に全情報がある:

```typescript
DiffResult {
  files: FileDiff[] {
    file: DiffFile { path, status, additions, deletions }
    hunks: DiffHunk[] {
      header: string           // "@@ -10,8 +10,11 @@"
      lines: DiffLine[] {
        origin: "+" | "-" | " "
        old_lineno: number | null
        new_lineno: number | null
        content: string         // ← 検索対象テキスト
      }
    }
    old_content: string | null  // ファイル全文（旧）
    new_content: string | null  // ファイル全文（新）
  }
}
```

**検索に使えるフィールド**:
- `DiffLine.content` — hunk 内の各行テキスト（diff 表示に対応）
- `FileDiff.new_content` / `old_content` — ファイル全文（`split("\n")` で行配列化）

---

## 4. 設計: ハイブリッドアーキテクチャ

データレベル検索（完全性）+ DOM レベルハイライト（視覚表現）の組み合わせ。

### 4.1 全体フロー

```
┌─────────────────────────────────────────────────────────────┐
│  ユーザー操作: Cmd+F → クエリ入力                             │
└────────────────────┬────────────────────────────────────────┘
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Phase 1: データレベル検索                                    │
│                                                             │
│  SearchIndex.search(query, diffResult)                      │
│    → DiffLine.content に対して String.indexOf()              │
│    → SearchMatch[] { filePath, lineNo, column, length }     │
│                                                             │
│  結果: 全マッチの完全なリスト（DOM 非依存）                     │
└────────────────────┬────────────────────────────────────────┘
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Phase 2: ナビゲーション                                      │
│                                                             │
│  ユーザーが Enter / ▲ / ▼ でマッチ間を移動                    │
│    → SearchMatch[currentIndex] から filePath + lineNo を取得  │
│    → 対象ファイル要素を DOM で特定 (data-file-path)            │
│    → scrollIntoView() で画面内に移動                          │
│    → Virtualizer が該当行を DOM にレンダリング（自動）          │
└────────────────────┬────────────────────────────────────────┘
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Phase 3: ハイライト描画                                      │
│                                                             │
│  スクロール完了後（requestAnimationFrame / setTimeout）       │
│    → collectTextNodes() で現在 DOM にあるテキストノードを収集   │
│    → データレベルのマッチ情報と DOM テキストを照合              │
│    → CSS Highlights API で Range を設定                       │
│    → current match は別色（オレンジ）でハイライト              │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 SearchIndex モジュール

```typescript
// src/utils/search-index.ts

export interface SearchMatch {
  /** ファイルパス */
  filePath: string;
  /** 行番号（1-indexed、new_lineno を優先、deletions は old_lineno） */
  lineNo: number;
  /** 行内のマッチ開始位置（0-indexed） */
  column: number;
  /** マッチ文字列長 */
  length: number;
  /** マッチ元の行の origin（+/-/空白）*/
  origin: "+" | "-" | " ";
  /** マッチ元の行テキスト（ハイライト照合用）*/
  lineText: string;
}

/**
 * DiffResult の全行をスキャンし、クエリにマッチする位置を返す。
 * DOM に一切依存しない純粋関数。
 */
export function searchDiff(
  query: string,
  diffResult: DiffResult,
  options?: { caseSensitive?: boolean },
): SearchMatch[] {
  if (!query) return [];

  const matches: SearchMatch[] = [];
  const q = options?.caseSensitive ? query : query.toLowerCase();

  for (const fileDiff of diffResult.files) {
    for (const hunk of fileDiff.hunks) {
      for (const line of hunk.lines) {
        const text = cleanLastNewline(line.content);
        const searchText = options?.caseSensitive ? text : text.toLowerCase();
        const lineNo = line.new_lineno ?? line.old_lineno;
        if (lineNo == null) continue;

        let pos = searchText.indexOf(q);
        while (pos !== -1) {
          matches.push({
            filePath: fileDiff.file.path,
            lineNo,
            column: pos,
            length: query.length,
            origin: line.origin,
            lineText: text,
          });
          pos = searchText.indexOf(q, pos + 1);
        }
      }
    }
  }

  return matches;
}
```

**特徴**:
- 純粋関数。React のレンダリングサイクルとは独立
- `DiffResult` のみに依存、DOM 不要
- hunk の行データを直接走査 → 折りたたみ/Virtualizer の影響を受けない
- `expandUnchanged: false` 時もコンテキスト行を含めた完全な検索

### 4.3 DiffSearchBar の改修

```typescript
// src/components/DiffSearchBar.tsx（改修後の疑似コード）

const DiffSearchBar: React.FC<Props> = ({ scrollContainerRef, onClose }) => {
  const diffResult = useStore(s => s.diffResult);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<SearchMatch[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);

  // --- Phase 1: データレベル検索 ---
  const doSearch = useCallback((q: string) => {
    if (!diffResult || !q) {
      setMatches([]);
      setCurrentIndex(-1);
      clearHighlights();
      return;
    }
    const results = searchDiff(q, diffResult);
    setMatches(results);
    if (results.length > 0) {
      setCurrentIndex(0);
      navigateToMatch(results[0]);
    } else {
      setCurrentIndex(-1);
      clearHighlights();
    }
  }, [diffResult]);

  // --- Phase 2: ナビゲーション ---
  const navigateToMatch = useCallback((match: SearchMatch) => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // ファイル要素を特定してスクロール
    const fileEl = container.querySelector(
      `[data-file-path="${CSS.escape(match.filePath)}"]`
    );
    if (!fileEl) return;

    // TODO: 行レベルのスクロール位置特定
    // Pierre の Shadow DOM 内で data-line-number 属性等を探す
    fileEl.scrollIntoView({ behavior: "smooth", block: "center" });

    // --- Phase 3: スクロール完了後にハイライト再適用 ---
    // scrollIntoView は非同期。ハイライト適用を遅延させる
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        applyHighlightsForVisibleMatches(query, matches, currentIndex);
      });
    });
  }, [scrollContainerRef, query, matches, currentIndex]);

  // --- Phase 3: ハイライト描画（DOM ベース、画面内のみ）---
  const applyHighlightsForVisibleMatches = useCallback(
    (q: string, allMatches: SearchMatch[], activeIndex: number) => {
      if (!scrollContainerRef.current || !q) return;
      clearHighlights();
      ensureShadowHighlightStyles(scrollContainerRef.current);

      // 現行と同じ: DOM テキストノード走査 + CSS Highlights
      const textNodes = collectTextNodes(scrollContainerRef.current);
      const ranges: Range[] = [];
      const lowerQ = q.toLowerCase();
      for (const node of textNodes) {
        const text = node.textContent?.toLowerCase() ?? "";
        let pos = text.indexOf(lowerQ);
        while (pos !== -1) {
          const range = new Range();
          range.setStart(node, pos);
          range.setEnd(node, pos + q.length);
          ranges.push(range);
          pos = text.indexOf(lowerQ, pos + 1);
        }
      }

      if (ranges.length > 0) {
        CSS.highlights!.set("diff-search", new Highlight(...ranges));
      }

      // current match のハイライトは、データレベルの activeIndex に基づいて
      // DOM 内で対応する Range を特定する（後述 4.5）
      highlightCurrentMatch(allMatches[activeIndex], textNodes);
    },
    [scrollContainerRef],
  );

  // ... UI は現行とほぼ同じ、matchCount は matches.length を使用
};
```

### 4.4 マッチ数表示の正確性

| 項目 | 現行（DOM ベース） | 改修後（ハイブリッド） |
|---|---|---|
| マッチ数 | DOM にある行のみカウント | **全行をカウント**（データレベル） |
| カウンタ表示 | `${currentIndex+1}/${matchCount}` | 同左、ただし matchCount が常に正確 |
| Virtualizer 導入時 | 画面外の行が欠落 | **影響なし** |

### 4.5 current match の DOM 照合

データレベルの `SearchMatch` と DOM テキストノードを照合する必要がある。

```typescript
function highlightCurrentMatch(
  match: SearchMatch,
  textNodes: Text[],
): void {
  // match.lineText と match.column を使って、
  // DOM テキストノード内の対応位置を特定する
  for (const node of textNodes) {
    const text = node.textContent ?? "";
    // 行テキストの一致を確認（Pierre が content をそのまま描画していることを利用）
    if (text.includes(match.lineText) || match.lineText.includes(text)) {
      // テキストノード内の column 位置に Range を作成
      // ※ Pierre はトークン単位で <span> を分割するため、
      //   1行が複数テキストノードにまたがる場合がある → 累積オフセットで計算
    }
  }
}
```

**注意点**: Pierre のシンタックスハイライトにより、1行のテキストが複数の `<span>` (= 複数テキストノード) に分割される。`collectTextNodes()` は全ノードをフラットに返すため、行境界の判定にはヒューリスティクスが必要。

**現実的な対処**: current match のハイライトは、DOM 走査の全マッチ Range 配列の中から「データレベルの currentIndex に最も近い位置のもの」を選ぶアプローチが堅牢:

```typescript
// DOM で見つかった Range 群から、データレベルの current match に対応するものを推定
// → ファイル内での出現順序が一致するものを選ぶ
```

### 4.6 スクロール時のハイライト再適用

Virtualizer 導入後、スクロールにより DOM の行が入れ替わる。ハイライトを維持するために:

```typescript
// スクロールイベントで debounce してハイライト再適用
useEffect(() => {
  const container = scrollContainerRef.current;
  if (!container || !query) return;

  let rafId = 0;
  const onScroll = () => {
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      applyHighlightsForVisibleMatches(query, matches, currentIndex);
    });
  };

  container.addEventListener("scroll", onScroll, { passive: true });
  return () => {
    container.removeEventListener("scroll", onScroll);
    cancelAnimationFrame(rafId);
  };
}, [query, matches, currentIndex]);
```

**パフォーマンス懸念**: スクロールのたびに `collectTextNodes()` + `indexOf()` を実行。
**緩和策**:
- `requestAnimationFrame` で 1 フレームに 1 回に制限
- テキストノード収集は可視領域のみに限定（`IntersectionObserver` 併用も検討）
- マッチ数が 0 のときはスキップ

---

## 5. Virtualizer 統合

### 5.1 導入方法

PIERRE_AUDIT.md の記載によると:

```tsx
import { Virtualizer } from "@pierre/diffs/react";

<Virtualizer>
  <MultiFileDiff oldFile={old} newFile={new} {...props} />
</Virtualizer>
```

ただし、Virtualizer の正確な動作（行レベル vs ファイルレベルの仮想化）は未検証。
`disableVirtualizationBuffers` オプションの存在から、何らかのバッファ付き仮想化が内部にあると推測される。

### 5.2 scrollIntoView の動作

Virtualizer が行レベルの仮想化を行う場合:

1. `scrollIntoView()` でファイル要素にスクロール
2. → Virtualizer が該当領域の行を DOM にレンダリング
3. → ただし、**目的の行**がレンダリングされるかはスクロール位置に依存
4. → 行レベルのスクロールには、行の高さ × 行番号のオフセット計算が必要

**代替案**: `expandUnchanged: false` を活用して表示行数を削減し、Virtualizer なしでもパフォーマンスを確保する。この場合、データレベル検索のマッチが折りたたまれた hunk 内にある場合、**事前に expandHunk を呼ぶ**必要がある。

### 5.3 段階的導入計画

Virtualizer の API 制約を踏まえ、以下の順序で導入する:

#### Phase 1: データレベル SearchIndex（Virtualizer なし）

**変更対象**: `src/utils/search-index.ts`（新規）, `src/components/DiffSearchBar.tsx`

- `searchDiff()` 関数を実装
- DiffSearchBar のマッチ数カウントをデータレベルに移行
- DOM ハイライトは現行方式を維持（全行が DOM にあるため動作する）
- **即座に得られる価値**: マッチ数が折りたたまれた hunk の行も含めて正確になる

#### Phase 2: expandUnchanged: false のデフォルト化

**変更対象**: `src/store/index.ts`, `src/components/DiffViewer.tsx`

- コンテキスト行を折りたたんで表示行数を削減
- 検索マッチが折りたたみ内にある場合の展開ロジック追加
- **得られる価値**: DOM ノード数の大幅削減、大規模 diff の描画パフォーマンス改善

#### Phase 3: Virtualizer 導入 + スクロール時ハイライト再適用

**変更対象**: `src/components/DiffViewer.tsx`, `src/components/DiffSearchBar.tsx`

- `Virtualizer` ラッパーを追加
- スクロールイベントでの CSS Highlights 再適用ロジック追加
- Phase 1 の SearchIndex が完全なマッチリストを保持しているため、
  Virtualizer が DOM を部分レンダリングしても検索結果は正確

---

## 6. 実装の詳細設計

### 6.1 ファイル構成

```
src/
├── utils/
│   ├── search-index.ts       # 新規: searchDiff(), SearchMatch 型
│   └── diff-utils.ts         # 既存: 変更なし
├── components/
│   ├── DiffSearchBar.tsx      # 改修: ハイブリッド検索
│   ├── DiffViewer.tsx         # Phase 2-3 で改修
│   └── MainContent.tsx        # 変更なし
└── store/
    └── index.ts               # 検索状態の追加（オプション）
```

### 6.2 検索状態の管理方針

**選択肢 A: DiffSearchBar 内のローカル state**（現行踏襲）
- SearchMatch[] を useState で管理
- コンポーネント間の連携が不要なら十分
- 検索バーを閉じると状態が消える（現行の挙動と同じ）

**選択肢 B: Zustand ストアに検索状態を追加**
- `searchQuery`, `searchMatches`, `searchCurrentIndex` をストアに格納
- 他のコンポーネント（サイドバー等）がマッチ数を表示可能
- 検索結果に基づいてファイルリストをフィルタリング可能

**推奨**: Phase 1 では **選択肢 A**。必要に応じて Phase 2 以降で B に昇格。

### 6.3 パフォーマンス見積もり

`searchDiff()` のコスト:

```
ファイル数: F, 平均行数/ファイル: L, クエリ長: Q

全行スキャン: O(F × L × 行テキスト長)
例: F=50, L=200, 平均行長=80 → 50 × 200 × 80 = 800KB のテキスト走査
→ String.indexOf() で ~1ms（ブラウザの最適化された文字列検索）
```

**結論**: データレベル検索のコストは無視できるレベル。debounce すら不要。

### 6.4 テスト方針

```typescript
// src/utils/__tests__/search-index.test.ts

describe("searchDiff", () => {
  it("全ファイル・全行からマッチを返す", () => {});
  it("case-insensitive がデフォルト", () => {});
  it("1行内の複数マッチを返す", () => {});
  it("追加行・削除行・コンテキスト行すべてが検索対象", () => {});
  it("空クエリで空配列を返す", () => {});
  it("バイナリファイルはスキップ", () => {}); // hunks が空
  it("マッチ順序がファイル順 → 行順", () => {});
});
```

---

## 7. リスクと緩和策

| リスク | 影響 | 緩和策 |
|---|---|---|
| Pierre のトークン分割により、DOM テキストノードと行テキストの対応が崩れる | current match ハイライトの位置ずれ | DOM 全マッチを走査し、出現順序でデータレベル index と照合 |
| Virtualizer のスクロール後、行が DOM に現れるまでのラグ | ハイライトが一瞬遅延 | double rAF + MutationObserver でレンダリング完了を検知 |
| `expandUnchanged: false` 時、マッチが折りたたみ内にある | ナビゲーションしてもハイライトが見えない | expandHunk の呼び出しが必要だが FileDiff インスタンスへのアクセスが困難 → Phase 2 で別途設計 |
| CSS Highlights API の未サポートブラウザ | ハイライトなし（検索自体は動作） | 現行と同じフォールバック（highlightsSupported チェック） |
| 大量マッチ（数千件）時の CSS Highlights パフォーマンス | 全マッチに Highlight を適用するとブラウザが重くなる | 画面内のマッチのみ Highlight に登録（IntersectionObserver で制御） |

---

## 8. 判断が必要な点

### 8.1 検索スコープ

現行の DOM ベース検索は行番号やインジケーター等のテキストもヒットする。
データレベル検索ではコード内容のみがヒットする。

**提案**: データレベルをデフォルトとする（コード検索として自然）。

### 8.2 削除行の検索

`DiffLine.origin === "-"` の行も検索対象にすべきか？

**提案**: デフォルトで含める（レビュー時に「削除されたコードのこの部分」を探すユースケースがある）。
将来的にフィルタ UI（additions only / deletions only / both）を検討。

### 8.3 expandUnchanged: false 時の折りたたみ内マッチ

マッチが折りたたまれた hunk 内にある場合、自動展開すべきか？

**提案**: Phase 1 ではナビゲーション時に `expandUnchanged: true` を一時的に設定するワークアラウンド。
Phase 2 で hunk 単位の展開制御を実装。

---

## 9. まとめ

| 観点 | 現行 | Phase 1 | Phase 2 | Phase 3 |
|---|---|---|---|---|
| 検索エンジン | DOM | **データ** | データ | データ |
| ハイライト | CSS Highlights | CSS Highlights | CSS Highlights | CSS Highlights + **スクロール時再適用** |
| マッチ数 | 画面内のみ | **全行** | 全行 | 全行 |
| ナビゲーション | 画面内のみ | **全マッチ** | 全マッチ | 全マッチ |
| 表示行数 | 全行 DOM | 全行 DOM | **折りたたみで削減** | **Virtualizer** |
| 実装コスト | — | **低** | 中 | 高 |
