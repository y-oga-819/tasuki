---
layout: page
title: ライブデモ
---

# ライブデモ

Tasukiのレビューインターフェースをブラウザで直接体験できます。モックデータを使用しているため、gitリポジトリは不要です。

<div style="margin: 24px 0;">
  <a href="/tasuki/app/" target="_blank" rel="noopener" style="display: inline-block; padding: 12px 24px; background: var(--vp-c-brand-1); color: #fff; border-radius: 8px; text-decoration: none; font-weight: 600;">
    デモを開く →
  </a>
</div>

## デモの内容

**10個の変更ファイル**を含むモックデータが表示されます：

| ファイル | 種別 | 特徴 |
|---------|------|------|
| `DiffViewer.tsx` | 変更 | 複数hunkのReactコンポーネントリファクタリング |
| `format-helpers.ts` | 追加 | 新しいユーティリティ関数 |
| `legacy-helpers.ts` | 削除 | 非推奨コードの除去 |
| `clipboard.ts` | リネーム | `copy-utils.ts`からAPI変更付き |
| `tokens.css` | 変更 | デザイントークンの更新 |
| `commands/diff.rs` | 変更 | Rustバックエンドの変更 |
| `package.json` | 変更 | 依存関係の追加 |
| `useFileWatcher.ts` | 変更 | Scroll/Wrapデモ用の長い行 |
| `USAGE_EXAMPLES.md` | 変更 | ドキュメントの更新 |
| `package-lock.json` | 生成 | 自動折りたたみのロックファイル |

## 試してみてください

1. **ビュー切替** — ツールバーのSplit/Unifiedを切り替える
2. **コメント追加** — 行番号の`+`ボタンをクリック
3. **ドキュメント閲覧** — サイドバーのドキュメントをクリックしてdiffの横に表示
4. **コメントコピー** — クリップボードボタンまたはReview Panelの「Copy All」
5. **図のズーム** — Mermaid図にホバーしてズームアイコンをクリック
