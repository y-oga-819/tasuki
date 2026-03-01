# GitHub リポジトリ設定ガイド

OSS として公開する際に、GitHub の Settings > Rules で以下の Ruleset を作成してください。

## 1. Branch ruleset — `main` 保護

Settings > Rules > Rulesets > New ruleset > New branch ruleset

| 項目 | 設定値 |
|------|--------|
| Ruleset name | `main-protection` |
| Enforcement status | Active |
| Target branches | `main` |

### 有効にするルール

- **Restrict deletions** — ブランチ削除を禁止
- **Require a pull request before merging**
  - Required approvals: `1`
  - Dismiss stale reviews when new commits are pushed: ON
  - Require review from Code Owners: ON
- **Require status checks to pass**
  - Status checks: `Frontend (Lint + Vitest)`, `Rust Tests`, `E2E (Playwright)`
  - Require branches to be up to date: ON
- **Block force pushes** — 履歴改変を禁止

## 2. Tag ruleset — リリースタグの保護

Settings > Rules > Rulesets > New ruleset > New tag ruleset

| 項目 | 設定値 |
|------|--------|
| Ruleset name | `release-tags` |
| Enforcement status | Active |
| Target tags | `v*` |

### 有効にするルール

- **Restrict creations** — Bypass list にメンテナーのみ追加
- **Restrict deletions** — タグ削除を禁止

> **Note**: Tag ruleset は GitHub Free プランでも public リポジトリで利用可能です。
