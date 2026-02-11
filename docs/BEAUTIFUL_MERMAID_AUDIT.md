# beautiful-mermaid 機能監査: tasuki における活用可能性

> 作成日: 2026-02-11
>
> beautiful-mermaid の全機能を洗い出し、tasuki の MarkdownViewer における活用方針をまとめる。

## 1. beautiful-mermaid の全体像

**パッケージ**: [`beautiful-mermaid`](https://www.npmjs.com/package/beautiful-mermaid)
**リポジトリ**: [lukilabs/beautiful-mermaid](https://github.com/lukilabs/beautiful-mermaid)
**公式サイト**: [agents.craft.do/mermaid](https://agents.craft.do/mermaid)
**開発元**: Craft (Craft Agents のダイアグラム描画エンジンとして開発)

### 特長

- **Zero DOM 依存** — 純粋な TypeScript。ブラウザ・Node.js・Bun・Deno どこでも動作
- **公式 mermaid パッケージ不要** — 独自にMermaid構文をパースしSVGを生成
- **超高速** — 100 以上のダイアグラムを 500ms 以下でレンダリング
- **デュアル出力** — SVG（リッチ UI 向け）と ASCII/Unicode（ターミナル向け）
- **CSS カスタムプロパティ** — 再レンダリング不要でライブテーマ切替
- **Shiki 互換** — VS Code テーマをそのままダイアグラムに適用可能

---

## 2. 対応ダイアグラム

| ダイアグラム種別 | Mermaid 構文例 | 用途 |
|---|---|---|
| **Flowchart** | `graph TD; A-->B` | フロー・プロセス・データフロー |
| **State Diagram** | `stateDiagram-v2` | 状態遷移 |
| **Sequence Diagram** | `sequenceDiagram` | オブジェクト間の時系列メッセージ |
| **Class Diagram** | `classDiagram` | クラス構造・継承関係 |
| **ER Diagram** | `erDiagram` | エンティティ・リレーション |

> **注意**: Gantt, Pie, Git Graph など、公式 mermaid にあるが beautiful-mermaid では未対応のダイアグラムが存在する。上記 5 種に限定されている。

---

## 3. API エクスポート

### 3.1 メインエクスポート

| エクスポート | 種別 | 説明 |
|---|---|---|
| `renderMermaid` | `async function` | Mermaid 構文 → SVG 文字列を生成 |
| `renderMermaidAscii` | `sync function` | Mermaid 構文 → ASCII/Unicode テキストを生成 |
| `THEMES` | `object` | 15 個の組み込みテーマオブジェクト |
| `DEFAULTS` | `object` | デフォルトカラー (`#FFFFFF` / `#27272A`) |
| `fromShikiTheme` | `function` | Shiki テーマ → ダイアグラムカラーに変換 |

### 3.2 `renderMermaid(diagram, options?)`

SVG レンダリングの主要関数。非同期。

```typescript
import { renderMermaid, THEMES } from 'beautiful-mermaid';

// デフォルトスタイル
const svg = await renderMermaid('graph TD; A-->B');

// テーマ指定
const svg = await renderMermaid('graph TD; A-->B', THEMES['tokyo-night']);

// カスタムカラー
const svg = await renderMermaid('graph TD; A-->B', {
  bg: '#0f0f0f',
  fg: '#e0e0e0',
  accent: '#60a5fa',
});

// 透過背景
const svg = await renderMermaid('graph TD; A-->B', { transparent: true });
```

**戻り値**: SVG 文字列。`dangerouslySetInnerHTML` や DOM 挿入で表示可能。

### 3.3 `renderMermaidAscii(diagram, options?)`

ターミナル向けの ASCII/Unicode レンダリング。同期関数。

```typescript
import { renderMermaidAscii } from 'beautiful-mermaid';

// Unicode（デフォルト: ┌─│ などの罫線文字）
const ascii = renderMermaidAscii('graph TD; A-->B');

// ASCII（+|-| を使用）
const ascii = renderMermaidAscii('graph TD; A-->B', { useAscii: true });
```

| オプション | 型 | デフォルト | 説明 |
|---|---|---|---|
| `useAscii` | `boolean` | `false` | `true` で基本 ASCII 文字を使用（`+`, `-`, `\|`）。`false` で Unicode 罫線文字 |
| `paddingX` | `number` | `5` | ノード間の水平スペーシング |
| `paddingY` | `number` | `5` | ノード間の垂直スペーシング |
| `boxBorderPadding` | `number` | `1` | ノードボックス内のパディング |

> ASCII エンジンは Alexander Grooff の [mermaid-ascii](https://github.com/AlexanderGrooff/mermaid-ascii)（Go）を TypeScript に移植・拡張したもの。

### 3.4 `fromShikiTheme(theme)`

Shiki テーマオブジェクトからダイアグラムカラーを抽出する。VS Code のエディタカラーをダイアグラムの各ロールにインテリジェントにマッピングする。

```typescript
import { fromShikiTheme } from 'beautiful-mermaid';
import vitesseDark from 'shiki/themes/vitesse-dark.mjs';

const colors = fromShikiTheme(vitesseDark);
const svg = await renderMermaid(diagram, colors);
```

tasuki は既に `shiki` を依存関係に持っているため、Pierre の diff テーマと Mermaid ダイアグラムのテーマを同一の VS Code テーマから統一的に導出できる。

---

## 4. テーマシステム

### 4.1 設計思想: Mono Mode

beautiful-mermaid のテーマシステムのコア原則: **2色あればダイアグラムが成立する**。

`bg`（背景）と `fg`（前景）の 2 色から、`color-mix()` CSS 関数を用いて全ての派生色を自動計算する。これを **Mono Mode** と呼ぶ。

### 4.2 カラーロール（7 つの CSS カスタムプロパティ）

| CSS 変数 | 必須 | 用途 | 未指定時のフォールバック |
|---|---|---|---|
| `--bg` | **必須** | 背景色 | — |
| `--fg` | **必須** | 前景色（テキスト） | — |
| `--line` | 任意 | エッジ・コネクター線 | `color-mix(in srgb, var(--fg) 30%, var(--bg))` |
| `--accent` | 任意 | 矢印ヘッド・ハイライト | `color-mix(in srgb, var(--fg) 50%, var(--bg))` |
| `--muted` | 任意 | 副次テキスト・ラベル | `color-mix(in srgb, var(--fg) 60%, var(--bg))` |
| `--surface` | 任意 | ノード背景のティント | `color-mix(in srgb, var(--fg) 3%, var(--bg))` |
| `--border` | 任意 | ノードのストローク | `color-mix(in srgb, var(--fg) 20%, var(--bg))` |

### 4.3 ライブテーマ切替

SVG 要素上の CSS カスタムプロパティを直接変更するだけで、再レンダリング不要でテーマ切替が可能:

```javascript
svgElement.style.setProperty('--bg', '#1a1b26');
svgElement.style.setProperty('--fg', '#a9b1d6');
```

### 4.4 組み込みテーマ一覧（15 テーマ）

| テーマ名 | 系統 |
|---|---|
| `zinc-light` | ライト |
| `zinc-dark` | ダーク |
| `tokyo-night` | ダーク |
| `tokyo-night-storm` | ダーク |
| `tokyo-night-light` | ライト |
| `catppuccin-mocha` | ダーク |
| `catppuccin-latte` | ライト |
| `nord` | ダーク |
| `nord-light` | ライト |
| `dracula` | ダーク |
| `github-light` | ライト |
| `github-dark` | ダーク |
| `solarized-light` | ライト |
| `solarized-dark` | ダーク |
| `one-dark` | ダーク |

### 4.5 カスタムテーマ作成

```typescript
// 最小構成（Mono Mode）
const myTheme = { bg: '#0f0f0f', fg: '#e0e0e0' };

// エンリッチメント付き
const myTheme = {
  bg: '#0f0f0f',
  fg: '#e0e0e0',
  accent: '#60a5fa',   // 矢印・ハイライト
  muted: '#6b7280',    // 副次テキスト
};
```

---

## 5. ブラウザバンドル

バンドラーを使わない環境向けに、グローバルバンドルが提供されている:

```html
<script src="beautiful-mermaid/dist/beautiful-mermaid.browser.global.js"></script>
<script>
  const { renderMermaid, THEMES } = beautifulMermaid;
</script>
```

`beautifulMermaid` グローバルオブジェクトに `renderMermaid`, `renderMermaidAscii`, `THEMES`, `DEFAULTS`, `fromShikiTheme` が公開される。

---

## 6. tasuki の現在の Mermaid 対応状況

### 6.1 現在の実装

**場所**: `src/components/MarkdownViewer.tsx:130-143`

```typescript
const MermaidBlock: React.FC<{ code: string }> = ({ code }) => {
  return (
    <div className="mermaid-block">
      <div className="mermaid-label">Mermaid Diagram</div>
      <pre className="mermaid-source">
        <code>{code}</code>
      </pre>
    </div>
  );
};
```

- ```` ```mermaid ```` コードフェンスを検出し `MermaidBlock` に渡す仕組みは**構築済み**
- 実際のレンダリングは行われず、ソースコードをプレースホルダーとして表示するのみ
- `package.json` に `beautiful-mermaid` は未インストール

### 6.2 依存関係の互換性

| 既存依存 | beautiful-mermaid との関係 |
|---|---|
| `shiki` (^3.4.2) | `fromShikiTheme()` で Shiki テーマをダイアグラムに変換可能。Pierre の diff テーマと統一できる |
| `react` (^19.2.0) | beautiful-mermaid は React 非依存（SVG 文字列を返す）。`dangerouslySetInnerHTML` で注入 |
| `@pierre/diffs` (^1.0.10) | テーマを `github-dark` / `github-light` で使用中。同じテーマを `fromShikiTheme` 経由で Mermaid に渡せる |

---

## 7. tasuki 統合方針

### 7.1 `MermaidBlock` の実装変更

現在のプレースホルダーを `renderMermaid` を使った実際のレンダリングに置き換える:

```typescript
const MermaidBlock: React.FC<{ code: string }> = ({ code }) => {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    renderMermaid(code, THEMES['github-dark'])
      .then(setSvg)
      .catch((e) => setError(e.message));
  }, [code]);

  if (error) return <div className="mermaid-error">...</div>;
  if (!svg) return <div className="mermaid-loading">...</div>;

  return (
    <div className="mermaid-block"
         dangerouslySetInnerHTML={{ __html: svg }} />
  );
};
```

### 7.2 テーマ連携

Pierre の diff 表示と同じ `github-dark` テーマを Mermaid にも適用すると、アプリ全体の色調が統一される:

```typescript
import { fromShikiTheme } from 'beautiful-mermaid';
import githubDark from 'shiki/themes/github-dark.mjs';

const mermaidTheme = fromShikiTheme(githubDark);
```

### 7.3 将来的な拡張ポイント

| 拡張 | 説明 | 優先度 |
|---|---|---|
| テーマ自動追従 | OS のダーク/ライトモードに応じて `github-dark` ↔ `github-light` を切替 | 中 |
| ライブテーマ切替 | CSS カスタムプロパティ経由でリレンダーなしにテーマ変更 | 低 |
| エラーフォールバック | 構文エラー時にソースコードを表示（現在のプレースホルダーと同等） | 高 |
| ダイアグラム種別ラベル | 自動検出したダイアグラム種別をラベル表示 | 低 |

---

## 8. 制約・注意事項

| 項目 | 詳細 |
|---|---|
| **対応ダイアグラム** | Flowchart, State, Sequence, Class, ER の 5 種のみ。Gantt, Pie, Git Graph, Mindmap, Timeline 等は未対応 |
| **公式 mermaid との互換性** | 独自パーサーのため、公式 mermaid の全構文がサポートされている保証はない |
| **SSR** | `renderMermaid` は async だがDOM 非依存のため、サーバーサイドでも使用可能 |
| **バンドルサイズ** | 公式 mermaid (~4MB) と比較して大幅に軽量だが、具体的なサイズは要検証 |
