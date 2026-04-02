import type { DiffResult, CommitInfo, ReviewSession, RepoInfo, CommitGateData, ChangeStatus } from "../types";
import { mockDiffResult, mockStagedDiffResult, mockWorkingDiffResult } from "../__fixtures__/mock-diff-data";
import { mockDocPaths, mockDesignDocNames, mockReviewDocNames, mockDocContents } from "../__fixtures__/mock-doc-data";
import { mockRepoInfo, mockCommitLog, mockHeadSha, mockDiffHash } from "../__fixtures__/mock-repo-data";

/**
 * Bridge to Tauri backend commands.
 *
 * In development without Tauri, these return mock data.
 * When running inside Tauri, they invoke real Rust commands.
 */

const isTauri = typeof window !== "undefined" && "__TAURI__" in window;

/** Return mock data for browser-only development. */
function mockInvoke<T>(cmd: string, args?: Record<string, unknown>): T {
  switch (cmd) {
    // Diff APIs
    case "get_diff":
    case "get_ref_diff":
    case "get_commit_diff":
      return mockDiffResult as T;
    case "get_staged_diff":
      return mockStagedDiffResult as T;
    case "get_working_diff":
      return mockWorkingDiffResult as T;

    // Repository info APIs
    case "get_repo_info":
      return mockRepoInfo as T;
    case "get_repo_path":
      return "/mock/repo/path" as T;
    case "get_head_sha":
      return mockHeadSha as T;
    case "get_log":
      return mockCommitLog as T;

    // Document APIs
    case "list_docs":
      return mockDocPaths as T;
    case "read_file": {
      const filePath = args?.filePath as string;
      return (mockDocContents[filePath] ?? `# ${filePath}\n\nMock content for ${filePath}`) as T;
    }
    case "list_design_docs":
      return mockDesignDocNames as T;
    case "read_design_doc": {
      const filename = args?.filename as string;
      return (mockDocContents[filename] ?? `# ${filename}\n\nMock design doc content`) as T;
    }
    case "list_review_docs":
      return mockReviewDocNames as T;
    case "read_review_doc": {
      const filename = args?.filename as string;
      return (mockDocContents[filename] ?? `# ${filename}\n\nMock review doc content`) as T;
    }

    // External docs APIs
    case "list_dir_docs":
      return ["example/design-overview.md", "example/api-spec.md"] as T;
    case "read_external_file": {
      const extPath = args?.filePath as string;
      return `# ${extPath}\n\nMock external file content for ${extPath}` as T;
    }

    // Review persistence APIs
    case "get_diff_hash":
      return mockDiffHash as T;
    case "save_review":
      console.log("[mock] saveReview", args);
      return undefined as T;
    case "load_review":
      return null as T;

    // Terminal APIs (no-op)
    case "spawn_terminal":
    case "write_terminal":
    case "resize_terminal":
    case "kill_terminal":
      return undefined as T;
    case "is_terminal_alive":
      return false as T;

    // Commit gate APIs (no-op)
    case "write_commit_gate":
      console.log("[mock] writeCommitGate", args);
      return "/tmp/tasuki/mock-repo/mock-branch/review.json" as T;
    case "read_commit_gate":
      return null as T;
    case "clear_commit_gate":
      return undefined as T;

    // Claude Code communication (no-op in browser)
    case "send_to_claude_code":
      console.log("[mock] sendToClaudeCode", args);
      return false as T;
    case "exit_app":
      console.log("[mock] exitApp");
      return undefined as T;

    // Zed integration (no-op)
    case "open_in_zed":
      console.log("[mock] openInZed", args);
      return undefined as T;

    // Change detection
    case "check_changes":
      return { head_sha: mockHeadSha, has_changes: true } as T;

    // File watcher (no-op)
    case "start_watching":
      return undefined as T;

    default:
      console.warn(`[mock] Unknown command: ${cmd}`, args);
      return undefined as T;
  }
}

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (isTauri) {
    const { invoke: tauriInvoke } = await import("@tauri-apps/api/core");
    return tauriInvoke<T>(cmd, args);
  }
  return mockInvoke<T>(cmd, args);
}

export async function getDiff(): Promise<DiffResult> {
  return invoke<DiffResult>("get_diff");
}

export async function getStagedDiff(): Promise<DiffResult> {
  return invoke<DiffResult>("get_staged_diff");
}

export async function getWorkingDiff(): Promise<DiffResult> {
  return invoke<DiffResult>("get_working_diff");
}

export async function getRefDiff(fromRef: string, toRef: string): Promise<DiffResult> {
  return invoke<DiffResult>("get_ref_diff", { fromRef, toRef });
}

export async function getCommitDiff(commitRef: string): Promise<DiffResult> {
  return invoke<DiffResult>("get_commit_diff", { commitRef });
}

export async function getLog(maxCount?: number): Promise<CommitInfo[]> {
  return invoke<CommitInfo[]>("get_log", { maxCount });
}

export async function listDocs(): Promise<string[]> {
  return invoke<string[]>("list_docs");
}

export async function readFile(filePath: string): Promise<string> {
  return invoke<string>("read_file", { filePath });
}

export async function startWatching(): Promise<void> {
  return invoke<void>("start_watching");
}

export async function getRepoInfo(): Promise<RepoInfo> {
  return invoke<RepoInfo>("get_repo_info");
}

export async function getRepoPath(): Promise<string> {
  return invoke<string>("get_repo_path");
}

export async function getHeadSha(): Promise<string> {
  return invoke<string>("get_head_sha");
}

export async function checkChanges(): Promise<ChangeStatus> {
  return invoke<ChangeStatus>("check_changes");
}

export async function getDiffHash(diffResult: DiffResult): Promise<string> {
  return invoke<string>("get_diff_hash", { diffResult });
}

export async function saveReview(
  headSha: string,
  sourceType: string,
  session: ReviewSession,
): Promise<void> {
  const jsonData = JSON.stringify(session);
  return invoke<void>("save_review", { headSha, sourceType, jsonData });
}

export async function loadReview(
  headSha: string,
  sourceType: string,
): Promise<ReviewSession | null> {
  const json = await invoke<string | null>("load_review", { headSha, sourceType });
  if (json === null) return null;
  return JSON.parse(json) as ReviewSession;
}

export async function listDesignDocs(): Promise<string[]> {
  return invoke<string[]>("list_design_docs");
}

export async function readDesignDoc(filename: string): Promise<string> {
  return invoke<string>("read_design_doc", { filename });
}

export async function listReviewDocs(): Promise<string[]> {
  return invoke<string[]>("list_review_docs");
}

export async function readReviewDoc(filename: string): Promise<string> {
  return invoke<string>("read_review_doc", { filename });
}

export async function spawnTerminal(cols: number, rows: number): Promise<void> {
  return invoke<void>("spawn_terminal", { cols, rows });
}

export async function writeTerminal(data: string): Promise<void> {
  return invoke<void>("write_terminal", { data });
}

export async function resizeTerminal(cols: number, rows: number): Promise<void> {
  return invoke<void>("resize_terminal", { cols, rows });
}

export async function killTerminal(): Promise<void> {
  return invoke<void>("kill_terminal");
}

export async function isTerminalAlive(): Promise<boolean> {
  return invoke<boolean>("is_terminal_alive");
}

// ---- Commit Gate ----

export async function writeCommitGate(
  status: "approved" | "rejected",
  diffHash: string,
  resolvedThreads: Array<{ file: string; line: number; body: string }>,
  resolvedDocComments: Array<{ file: string; section: string; body: string }>,
  unresolvedThreads: Array<{ file: string; line: number; body: string; code_snippet?: string }> = [],
): Promise<string> {
  const resolvedThreadsJson = JSON.stringify(resolvedThreads);
  const resolvedDocCommentsJson = JSON.stringify(resolvedDocComments);
  const unresolvedThreadsJson = JSON.stringify(unresolvedThreads);
  return invoke<string>("write_commit_gate", {
    status,
    diffHash,
    resolvedThreads: resolvedThreadsJson,
    resolvedDocComments: resolvedDocCommentsJson,
    unresolvedThreads: unresolvedThreadsJson,
  });
}

export async function readCommitGate(): Promise<CommitGateData | null> {
  const json = await invoke<string | null>("read_commit_gate");
  if (json === null) return null;
  return JSON.parse(json) as CommitGateData;
}

export async function clearCommitGate(): Promise<void> {
  return invoke<void>("clear_commit_gate");
}

// ---- Claude Code Communication ----

export async function sendToClaudeCode(message: string): Promise<boolean> {
  return invoke<boolean>("send_to_claude_code", { message });
}

export async function exitApp(): Promise<void> {
  return invoke<void>("exit_app");
}

// ---- External Docs ----

export async function listDirDocs(dirPath: string): Promise<string[]> {
  return invoke<string[]>("list_dir_docs", { dirPath });
}

export async function readExternalFile(filePath: string): Promise<string> {
  return invoke<string>("read_external_file", { filePath });
}

export async function pickFolder(): Promise<string | null> {
  if (isTauri) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const result = await open({ directory: true, multiple: false });
    return result as string | null;
  }
  // Browser mock: return a fake path
  return "/mock/external/docs";
}

// ---- Zed Integration ----

export async function openInZed(filePath?: string, line?: number): Promise<void> {
  return invoke<void>("open_in_zed", { filePath: filePath ?? null, line: line ?? null });
}

export async function readFromClipboard(): Promise<string> {
  if (isTauri) {
    const { readText } = await import("@tauri-apps/plugin-clipboard-manager");
    return await readText();
  }
  return await navigator.clipboard.readText();
}

export async function copyToClipboard(text: string): Promise<void> {
  if (isTauri) {
    const { writeText } = await import("@tauri-apps/plugin-clipboard-manager");
    await writeText(text);
  } else {
    await navigator.clipboard.writeText(text);
  }
}
