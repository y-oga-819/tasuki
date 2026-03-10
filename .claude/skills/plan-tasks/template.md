# タスクリストテンプレート

このテンプレートを参考にタスクリストを生成する。

---

```markdown
# {機能名} タスクリスト

## Overview

{設計書からの要約: 何を実装するか、なぜ必要か}

---

## Phase 1: {Phase名}

{Phaseの目的と概要}

### Targets

- {ファイルパス} - {変更内容}
- {ファイルパス} - {変更内容}

### References

- {ファイルパス} - {参照理由}

### Tasks

- [ ] {タスク1}
- [ ] {タスク2}
- [ ] {タスク3}

---

## Phase 2: {Phase名}

{Phaseの目的と概要}

### Targets

- {ファイルパス} - {変更内容}

### References

- {ファイルパス} - {参照理由}

### Tasks

- [ ] {タスク1}
- [ ] {タスク2}

---

## Phase 3: {Phase名}

{Phaseの目的と概要}

### Targets

- {ファイルパス} - {変更内容}

### References

- {ファイルパス} - {参照理由}

### Tasks

- [ ] {タスク1}
- [ ] {タスク2}

---

## Note

{実装にあたって注意するべきことがあれば記載}

- {注意点1}
- {注意点2}
```

---

## 記述ルール

### Phase

- 設計書の Step に対応させる
- 1 Phase = 1 コミット単位が目安
- Phase 間の依存関係がある場合は順序に注意

### Targets

- **変更する**ファイルのみを記載
- 新規作成の場合は `(新規)` を付記
- 削除の場合は `(削除)` を付記

### References

- **参照のみ**のファイルを記載（変更しない）
- 既存パターンの確認、移植元など
- Targets と重複しないこと

### Tasks

- フラットなリスト（ネストしない）
- チェックボックス `- [ ]` を使用
- TDD の順序: テスト → 実装 → リファクタリング
- 1タスク = 小さな変更単位
- 完了したら `- [x]` に変更

### Note

- 実装時の注意点
- 技術的な制約
- 参考にすべき既存コード
- スコープ外の明示

---

## 良い例

```markdown
## Phase 1: ユースケース層の基盤作成

CreateTaskUseCase を実装し、既存の service 層からロジックを移植する。

### Targets

- internal/usecase/task/create_task.go (新規)
- internal/usecase/task/create_task_test.go (新規)

### References

- internal/service/todo.go - 既存ロジックの移植元
- internal/domain/task.go - エンティティ定義

### Tasks

- [ ] CreateTaskUseCase のインターフェースのテストを書く
- [ ] CreateTaskUseCase のインターフェースを定義
- [ ] Create メソッドの正常系テストを書く
- [ ] Create メソッドを仮実装
- [ ] service/todo.go から作成ロジックを移植
- [ ] バリデーションエラーのテストを書く
- [ ] バリデーションを実装
```

## 悪い例

```markdown
## Phase 1: ユースケース実装

### Tasks

- [ ] RED: テストを書く
- [ ] GREEN: 実装する
  - [ ] インターフェース定義
  - [ ] メソッド実装
- [ ] REFACTOR: リファクタリング
```

→ 問題点:
- RED/GREEN/REFACTOR の prefix は不要
- タスクがネストしている
- 粒度が曖昧
