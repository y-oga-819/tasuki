# モックデータ拡充プラン

## 目的
- スクリーンショット・GIF撮影に耐えるリッチなモックデータを用意する
- E2Eテストでより多くのUIパターンを検証できるようにする

## E2Eテスト既存依存（壊してはいけないもの）
- `src/components/DiffViewer.tsx` がdiffに含まれ、12行目前後にコードがあること
- `architecture` を含むドキュメントが存在すること
- ファイル数が4以上であること
- ユニットテストはフィクスチャに依存しないため影響なし

---

## 変更対象ファイル

### 1. `src/__fixtures__/mock-diff-data.ts` — Diffデータの拡充

**既存4ファイルの拡充:**
- `src/components/DiffViewer.tsx`（modified）— hunkを拡大して30行程度に。複数hunkにする。実際のReactコンポーネントらしいコードで、レビューしたくなるような変更内容にする

**新規6ファイルの追加（計10ファイル）:**

| ファイル | status | 狙い |
|---------|--------|------|
| `src/styles/tokens.css` | modified | CSS変数の変更。色の追加・変更がわかるdiff |
| `src-tauri/src/commands.rs` | modified | Rust コード。多言語シンタックスハイライトのデモ |
| `package.json` | modified | JSON差分。依存追加が見えるdiff |
| `src/hooks/useFileWatcher.ts` | modified | 長い行を含む（Scroll/Wrapデモ用）。複数hunk |
| `docs/USAGE_EXAMPLES.md` | modified | Markdown差分。ドキュメント更新のdiff |
| `package-lock.json` | modified | `is_generated: true`。自動折りたたみのデモ用。最小限のhunk |

**stats**: 10 files changed, +120前後, -40前後（見栄えの良い数字）

### 2. `src/__fixtures__/mock-doc-data.ts` — ドキュメントの拡充

**`docs/architecture.md` の拡充:**
- 複数のMermaid図（graph TD + sequenceDiagram + flowchart）
- コードブロック（TypeScript, Rust, YAML）
- テーブル（技術スタック一覧）
- ネストリスト

**`docs/review-workflow.md` の拡充:**
- ステップごとのコード例
- Tips/Notesの書式
- シーケンス図（Claude Code ↔ Tasuki のやりとり）

**新規ドキュメント追加:**
- `docs/getting-started.md` — インストール手順、CLI使い方、最初のレビューまでの流れ

**設計書の拡充:**
- `0001_ui-improvements.md` — Mermaidフローチャート付き
- レビュードキュメントの内容も充実させる

### 3. `src/__fixtures__/mock-repo-data.ts` — 小幅な調整

- コミットログを5件に増やす（より現実的に）
- ブランチ名を `claude/implement-review-ui-rVx3k` に変更（Tasukiの実際の使い方を反映）

### 4. `src/utils/tauri-api.ts` — 変更なし
- フィクスチャからインポートしているだけなので、フィクスチャ変更が自動的に反映される

### 5. E2Eテストの更新

**既存テスト:**
- `ux1`: `count >= 4` → `count >= 10` に変更（ファイル数増加を反映）

**新規テストケース（既存specファイルに追加）:**
- `ux1`: 生成ファイル（package-lock.json）がデフォルトで折りたたまれていることを検証
- `ux1`: Scroll/Wrap切替が実際に効くこと（長い行が含まれるため検証可能に）
- `ux5`: 複数Mermaid図（graph + sequence）がレンダリングされることを検証
- `ux5`: Markdownテーブルが正しくレンダリングされることを検証

---

## 実装順序

1. `mock-diff-data.ts` — 既存ファイルの拡充 + 新規ファイル追加
2. `mock-doc-data.ts` — ドキュメント内容の拡充
3. `mock-repo-data.ts` — コミットログ拡充
4. E2Eテスト更新 — 既存テストの調整 + 新規テストケース追加
5. `npm run lint` + `npm test` + `npm run build` で検証
