import type { CommitInfo, RepoInfo } from "../types";

/** リポジトリ情報（getRepoInfo の戻り値） */
export const mockRepoInfo: RepoInfo = {
  repo_name: "tasuki",
  branch_name: "claude/implement-review-ui-rVx3k",
  is_worktree: false,
};

/** コミットログ（getLog の戻り値） */
export const mockCommitLog: CommitInfo[] = [
  {
    id: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
    short_id: "a1b2c3d",
    message: "feat: add line comment functionality with range selection",
    author: "claude",
    time: 1700000000,
  },
  {
    id: "b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3",
    short_id: "b2c3d4e",
    message: "refactor: extract format helpers and clipboard utilities",
    author: "claude",
    time: 1699990000,
  },
  {
    id: "c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4",
    short_id: "c3d4e5f",
    message: "feat: add design tokens and CSS custom properties",
    author: "developer",
    time: 1699980000,
  },
  {
    id: "d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5",
    short_id: "d4e5f6a",
    message: "fix: file watcher resource leak on re-render",
    author: "developer",
    time: 1699970000,
  },
  {
    id: "e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6",
    short_id: "e5f6a1b",
    message: "chore: remove legacy utils and update dependencies",
    author: "claude",
    time: 1699960000,
  },
];

/** 固定 HEAD SHA（getHeadSha の戻り値） */
export const mockHeadSha = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";

/** 固定 diff ハッシュ（getDiffHash の戻り値） */
export const mockDiffHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
