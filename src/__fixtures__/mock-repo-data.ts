import type { CommitInfo, RepoInfo } from "../types";

/** リポジトリ情報（getRepoInfo の戻り値） */
export const mockRepoInfo: RepoInfo = {
  repo_name: "tasuki",
  branch_name: "feature/add-review-comments",
  is_worktree: false,
};

/** コミットログ（getLog の戻り値） */
export const mockCommitLog: CommitInfo[] = [
  {
    id: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
    short_id: "a1b2c3d",
    message: "feat: add line comment functionality",
    author: "developer",
    time: 1700000000,
  },
  {
    id: "b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3",
    short_id: "b2c3d4e",
    message: "refactor: extract format helpers",
    author: "developer",
    time: 1699990000,
  },
  {
    id: "c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4",
    short_id: "c3d4e5f",
    message: "chore: remove legacy utils",
    author: "developer",
    time: 1699980000,
  },
];

/** 固定 HEAD SHA（getHeadSha の戻り値） */
export const mockHeadSha = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";

/** 固定 diff ハッシュ（getDiffHash の戻り値） */
export const mockDiffHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
