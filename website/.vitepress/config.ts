import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Tasuki",
  description: "Code review assistant — relay the baton between Claude Code and humans",
  base: "/tasuki/",
  cleanUrls: true,
  head: [
    ["link", { rel: "icon", type: "image/png", href: "/tasuki/logo.png" }],
  ],

  locales: {
    root: {
      label: "English",
      lang: "en",
      themeConfig: {
        nav: [
          { text: "Guide", link: "/guide/what-is-tasuki" },
          { text: "Demo", link: "/demo" },
        ],
        sidebar: [
          {
            text: "Introduction",
            items: [
              { text: "What is Tasuki?", link: "/guide/what-is-tasuki" },
              { text: "Getting Started", link: "/guide/getting-started" },
            ],
          },
          {
            text: "Features",
            items: [
              { text: "Diff Review", link: "/guide/diff-review" },
              { text: "Comments & Verdicts", link: "/guide/comments" },
              { text: "Document Viewer", link: "/guide/documents" },
            ],
          },
        ],
        socialLinks: [
          { icon: "github", link: "https://github.com/y-oga-819/tasuki" },
        ],
      },
    },
    ja: {
      label: "日本語",
      lang: "ja",
      themeConfig: {
        nav: [
          { text: "ガイド", link: "/ja/guide/what-is-tasuki" },
          { text: "デモ", link: "/ja/demo" },
        ],
        sidebar: [
          {
            text: "はじめに",
            items: [
              { text: "Tasukiとは", link: "/ja/guide/what-is-tasuki" },
              { text: "セットアップ", link: "/ja/guide/getting-started" },
            ],
          },
          {
            text: "機能",
            items: [
              { text: "Diffレビュー", link: "/ja/guide/diff-review" },
              { text: "コメントと判定", link: "/ja/guide/comments" },
              { text: "ドキュメントビューア", link: "/ja/guide/documents" },
            ],
          },
        ],
        socialLinks: [
          { icon: "github", link: "https://github.com/y-oga-819/tasuki" },
        ],
      },
    },
  },

  themeConfig: {
    search: {
      provider: "local",
    },
    footer: {
      message: "Released under the MIT License.",
      copyright: "Copyright © 2025 y-oga-819",
    },
  },
});
