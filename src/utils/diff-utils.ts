import { cleanLastNewline } from "@pierre/diffs";
import type { FileDiff } from "../types";

/** Get a code snippet from a file diff at specified line range */
export function getCodeSnippet(
  fileDiff: FileDiff,
  lineStart: number,
  lineEnd: number,
): string {
  // Prefer extracting from new_content directly (Pierre-native path)
  if (fileDiff.new_content != null) {
    const allLines = fileDiff.new_content.split("\n");
    // lineStart/lineEnd are 1-indexed
    return allLines.slice(lineStart - 1, lineEnd).join("\n");
  }

  // Fallback: extract from hunk line data
  // Use new_lineno to match new-side lines; skip deleted lines (new_lineno=null)
  const lines: string[] = [];
  for (const hunk of fileDiff.hunks) {
    for (const line of hunk.lines) {
      const lineNo = line.new_lineno;
      if (lineNo != null && lineNo >= lineStart && lineNo <= lineEnd) {
        lines.push(cleanLastNewline(line.content));
      }
    }
  }
  return lines.join("\n");
}

/** Format a line reference string (e.g. "L10" or "L10-15") */
export function formatLineRef(lineStart: number, lineEnd: number): string {
  return lineStart === lineEnd
    ? `L${lineStart}`
    : `L${lineStart}-${lineEnd}`;
}

/** Get a display-friendly file name */
export function getFileName(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1];
}

/** Get the directory part of a path */
export function getFileDir(path: string): string {
  const parts = path.split("/");
  return parts.slice(0, -1).join("/");
}

/** Status → { color, label } mapping */
const STATUS_MAP: Record<string, { color: string; label: string }> = {
  added:    { color: "var(--color-added)",    label: "A" },
  deleted:  { color: "var(--color-deleted)",  label: "D" },
  modified: { color: "var(--color-modified)", label: "M" },
  renamed:  { color: "var(--color-renamed)",  label: "R" },
  copied:   { color: "var(--color-text-secondary)", label: "C" },
};

/** Get status badge color */
export function getStatusColor(status: string): string {
  return STATUS_MAP[status]?.color ?? "var(--color-text-secondary)";
}

/** Get status label */
export function getStatusLabel(status: string): string {
  return STATUS_MAP[status]?.label ?? "?";
}

/**
 * Generate a full git-format patch string for use with PatchDiff.
 * Only used as fallback when old_content/new_content are unavailable.
 */
export function generateGitPatch(fileDiff: FileDiff): string {
  const lines: string[] = [];
  const oldPath = fileDiff.file.old_path || fileDiff.file.path;
  const newPath = fileDiff.file.path;

  if (fileDiff.file.status === "added") {
    lines.push(`diff --git a/${newPath} b/${newPath}`);
    lines.push("new file mode 100644");
    lines.push("--- /dev/null");
    lines.push(`+++ b/${newPath}`);
  } else if (fileDiff.file.status === "deleted") {
    lines.push(`diff --git a/${oldPath} b/${oldPath}`);
    lines.push("deleted file mode 100644");
    lines.push(`--- a/${oldPath}`);
    lines.push("+++ /dev/null");
  } else if (fileDiff.file.status === "renamed") {
    lines.push(`diff --git a/${oldPath} b/${newPath}`);
    lines.push(`rename from ${oldPath}`);
    lines.push(`rename to ${newPath}`);
    lines.push(`--- a/${oldPath}`);
    lines.push(`+++ b/${newPath}`);
  } else {
    lines.push(`diff --git a/${oldPath} b/${newPath}`);
    lines.push(`--- a/${oldPath}`);
    lines.push(`+++ b/${newPath}`);
  }

  for (const hunk of fileDiff.hunks) {
    lines.push(hunk.header);
    for (const line of hunk.lines) {
      lines.push(`${line.origin}${cleanLastNewline(line.content)}`);
    }
  }

  return lines.join("\n");
}
