# CLAUDE.md — Tasuki 開発ガイド

レビュー補助ツール: Claude Code と人間が襷を渡し合いながらゴールに向かう

## プロジェクト構成

- **フロントエンド**: React + TypeScript + Vite (port 1420)
- **デスクトップ**: Tauri v2 (`src-tauri/`)
- **状態管理**: Zustand (`src/store/`)
- **テスト**: Vitest (unit) + Playwright (e2e)

## コマンド

| 用途 | コマンド |
|------|---------|
| ユニットテスト | `npm test` |
| E2E テスト | `npm run test:e2e` |
| Lint | `npm run lint` |
| ビルド | `npm run build` |
| 開発サーバー | `npm run dev` |

## 実装後の自動チェック (CI / Claude Code で実行可能)

変更を push する前に必ず以下を通すこと:

1. `npm run lint` — ESLint
2. `npm test` — Vitest ユニットテスト
3. `npm run build` — TypeScript コンパイル + Vite ビルド

## 実装後の手動確認チェックリスト

以下は自動テストではカバーしきれない項目。実装内容に応じて該当する項目を確認すること。

### UI / 表示

- [ ] diff 表示が正しくレンダリングされるか（追加/削除/変更行の色分け）
- [ ] Shadow DOM 内のコンポーネントが正しく表示されるか
- [ ] ダークモード / ライトモードで表示が崩れないか

### レビュー機能

- [ ] 行コメントが正しい行に紐付くか
- [ ] コメントのコピー機能が動作するか（クリップボード）
- [ ] 全コメント一括コピーが動作するか
- [ ] ドキュメント並列表示が正しく機能するか

### Tauri 固有

- [ ] Tauri API 呼び出し（clipboard, dialog, shell）が実機で動作するか
- [ ] `npm run dev` だけでなく `npm run tauri dev` でも動作するか

### ブラウザ互換性

- [ ] Chromium 系ブラウザで動作するか（Tauri WebView = WebKit だが E2E は Chromium）

## 注意事項

- Vitest は `environment: "node"` で動作する。ブラウザ API (`window`, `document` 等) を参照するコードにはガード (`typeof window !== "undefined"`) を入れること
- `src/store/index.ts` の `__zustandStore` 公開は DEV モード + ブラウザ環境のみ
- E2E テストは `localhost:1420` の開発サーバーに接続する。`reuseExistingServer: true` なので事前に `npm run dev` を起動しておくと速い
