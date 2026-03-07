---
layout: home

hero:
  name: Tasuki
  text: コードレビューアシスタント
  tagline: Claude Codeと人間のレビュアーが襷を渡し合いながらゴールへ
  actions:
    - theme: brand
      text: ガイドを読む
      link: /ja/guide/what-is-tasuki
    - theme: alt
      text: デモを試す
      link: /ja/demo
    - theme: alt
      text: GitHub
      link: https://github.com/y-oga-819/tasuki

features:
  - icon: 🔍
    title: リッチなDiffビューア
    details: Split/Unified切替、シンタックスハイライト対応。TypeScript、Rust、CSS、Markdownなど多言語のdiffを表示。
  - icon: 💬
    title: インラインコメント
    details: 行番号をクリックしてレビューコメントを追加。範囲選択で複数行コメントも可能。個別・一括コピー対応。
  - icon: 📄
    title: ドキュメントペイン
    details: Diffの横に設計書を並べて表示。Mermaid図はインタラクティブなSVGとしてレンダリング、ズーム機能付き。
  - icon: 🔒
    title: コミットゲート
    details: Approve/Rejectでレビュー判定。gitフックがゲートファイルをチェックし、未承認のコードはコミットできない仕組み。
  - icon: 🖥️
    title: 内蔵ターミナル
    details: レビュー画面を離れずにコマンド実行。xterm.jsとportable-ptyによる本格的なターミナル。
  - icon: ⚡
    title: 軽量・高速
    details: Tauri v2で構築。Electronのオーバーヘッドなし、バイナリサイズは10MB以下。
---
