import type { GateThread, GateDocThread } from "../types";
import * as api from "./tauri-api";

/**
 * Module-level hash of the last gate file content we wrote.
 * Used by useReviewPersistence's watcher to skip self-triggered events.
 */
let lastWrittenHash: string | null = null;

export function getLastWrittenHash(): string | null {
  return lastWrittenHash;
}

export function clearLastWrittenHash(): void {
  lastWrittenHash = null;
}

/**
 * Write gate file and update the hash so the file watcher can
 * distinguish self-writes from external changes.
 */
export async function writeGateFile(
  status: "approved" | "rejected",
  gateThreads: GateThread[],
  gateDocThreads: GateDocThread[],
): Promise<string> {
  const gatePath = await api.writeCommitGate(status, gateThreads, gateDocThreads);
  lastWrittenHash = JSON.stringify({ gateThreads, gateDocThreads, status });
  return gatePath;
}
