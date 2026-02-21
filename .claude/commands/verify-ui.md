Playwright MCP を使って tasuki の UI を実際のブラウザで動作確認するコマンドです。

## 前提条件

- dev サーバーが起動している必要があります (`npm run dev` → http://localhost:1420)
- サーバーが起動していない場合は、先に Bash で `npm run dev` をバックグラウンドで起動してください

## 手順

以下の手順で Playwright MCP のブラウザツールを使って動作確認を行ってください。

### 1. アプリの起動確認

`browser_navigate` で http://localhost:1420 を開き、`browser_snapshot` でアクセシビリティツリーを確認してください。
ページタイトル (`h1.toolbar-title`) が表示されていれば OK です。

### 2. Diff ビューの確認

`browser_snapshot` を取得して、diff の行 (`[data-line]` 要素) が描画されているか確認してください。

### 3. Shadow DOM 内の操作テスト

Pierre の `<diffs-container>` は Shadow DOM を使用しています。以下を順に試してください:

1. **hover テスト**: diff 行の上で `browser_hover` を実行し、`browser_snapshot` を取得。
   `.dv-hover-comment-btn` (+ ボタン) が出現するか確認。
2. **ボタンクリック**: もし + ボタンが見つかったら `browser_click` で押下。
   コメントフォーム (`textarea.dv-form-textarea`) が開くか確認。
3. **フォーム送信**: テキストを入力して "Add Comment" ボタンを `browser_click` で押下。
   `.comment-body` にコメントが表示されるか確認。

### 4. スクリーンショット

各ステップで `browser_take_screenshot` を実行して、見た目を確認してください。

### 5. 結果報告

確認結果を以下の形式で報告してください:

| ステップ | 操作 | 期待結果 | 実結果 | 判定 |
|----------|------|----------|--------|------|
| hover    | diff行にhover | +ボタン表示 | ... | OK/NG |
| click    | +ボタンclick | フォーム表示 | ... | OK/NG |
| submit   | Add Commentクリック | コメント追加 | ... | OK/NG |

## 注意事項

- Shadow DOM 内の要素は Playwright MCP の `browser_click` では操作できない可能性があります
  (e2e テストでは `<diffs-container>` がポインタイベントを遮断することを確認済み)
- その場合は `browser_evaluate` で JavaScript を直接実行して操作してください
- hover で + ボタンが出ない場合も想定内です (e2e テストで確認済みの既知の制限)
