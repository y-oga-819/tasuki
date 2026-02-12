import type { DiffResult, CommitInfo, ReviewSession, RepoInfo } from "../types";

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

export async function copyToClipboard(text: string): Promise<void> {
  if (isTauri) {
    const { writeText } = await import("@tauri-apps/plugin-clipboard-manager");
    await writeText(text);
  } else {
    await navigator.clipboard.writeText(text);
  }
}
