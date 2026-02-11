import type { FileDiff, DiffHunk } from "../types";

/** Get a code snippet from a file diff at specified line range */
export function getCodeSnippet(
  fileDiff: FileDiff,
  lineStart: number,
  lineEnd: number,
): string {
  const lines: string[] = [];

  for (const hunk of fileDiff.hunks) {
    for (const line of hunk.lines) {
      const lineNo = line.new_lineno ?? line.old_lineno;
      if (lineNo && lineNo >= lineStart && lineNo <= lineEnd) {
        lines.push(line.content.replace(/\n$/, ""));
      }
    }
  }

  return lines.join("\n");
}

/** Get the file extension for syntax highlighting */
export function getFileExtension(path: string): string {
  const parts = path.split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
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

/** Get status badge color */
export function getStatusColor(
  status: string,
): string {
  switch (status) {
    case "added":
      return "var(--color-added)";
    case "deleted":
      return "var(--color-deleted)";
    case "modified":
      return "var(--color-modified)";
    case "renamed":
      return "var(--color-renamed)";
    default:
      return "var(--color-text-secondary)";
  }
}

/** Get status label */
export function getStatusLabel(status: string): string {
  switch (status) {
    case "added":
      return "A";
    case "deleted":
      return "D";
    case "modified":
      return "M";
    case "renamed":
      return "R";
    case "copied":
      return "C";
    default:
      return "?";
  }
}

/** Generate a unified diff string for a file */
export function generateUnifiedDiff(fileDiff: FileDiff): string {
  const lines: string[] = [];

  lines.push(`--- a/${fileDiff.file.old_path || fileDiff.file.path}`);
  lines.push(`+++ b/${fileDiff.file.path}`);

  for (const hunk of fileDiff.hunks) {
    lines.push(hunk.header);
    for (const line of hunk.lines) {
      lines.push(`${line.origin}${line.content.replace(/\n$/, "")}`);
    }
  }

  return lines.join("\n");
}
