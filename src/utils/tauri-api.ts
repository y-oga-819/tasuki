import type { DiffResult, CommitInfo, ReviewSession, RepoInfo, CommitGateData } from "../types";

/**
 * Bridge to Tauri backend commands.
 *
 * In development without Tauri, these return mock data.
 * When running inside Tauri, they invoke real Rust commands.
 */

// Check if we're running inside Tauri
const isTauri = typeof window !== "undefined" && "__TAURI__" in window;

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (isTauri) {
    const { invoke: tauriInvoke } = await import("@tauri-apps/api/core");
    return tauriInvoke<T>(cmd, args);
  }
  // Fallback for development outside Tauri
  throw new Error(`Tauri not available. Command: ${cmd}`);
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
  resolvedComments: Array<{ file: string; line: number; body: string; resolution_memo: string | null }>,
  resolvedDocComments: Array<{ file: string; section: string; body: string; resolution_memo: string | null }>,
): Promise<void> {
  const resolvedCommentsJson = JSON.stringify(resolvedComments);
  const resolvedDocCommentsJson = JSON.stringify(resolvedDocComments);
  return invoke<void>("write_commit_gate", {
    status,
    diffHash,
    resolvedComments: resolvedCommentsJson,
    resolvedDocComments: resolvedDocCommentsJson,
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
