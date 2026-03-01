import type { ReviewComment, ReviewThread, DocComment, ReviewVerdict } from "../types";
import { formatLineRef } from "./diff-utils";

/** Generate the structured review prompt for Copy All */
export function formatReviewPrompt(
  threads: ReviewThread[],
  docComments: DocComment[],
  verdict: ReviewVerdict,
): string {
  const parts: string[] = [];

  // Header with verdict
  const verdictLabel =
    verdict === "approve"
      ? "Approve"
      : verdict === "request_changes"
        ? "Request Changes"
        : "Comments";
  parts.push(`## Review Result: ${verdictLabel}\n`);

  // Group threads by file
  const byFile = new Map<string, ReviewThread[]>();
  for (const thread of threads) {
    const filePath = thread.root.file_path;
    const existing = byFile.get(filePath) || [];
    existing.push(thread);
    byFile.set(filePath, existing);
  }

  // Output code threads
  for (const [filePath, fileThreads] of byFile) {
    parts.push(`### ${filePath}`);
    for (const thread of fileThreads) {
      const c = thread.root;
      parts.push(`- ${formatLineRef(c.line_start, c.line_end)}`);
      if (c.code_snippet) {
        const snippetLines = c.code_snippet
          .split("\n")
          .map((line) => `  > ${line}`)
          .join("\n");
        parts.push(snippetLines);
      }
      parts.push(`  ${c.body}`);
      // Include replies
      for (const reply of thread.replies) {
        parts.push(`  ↳ ${reply.body} — ${reply.author}`);
      }
      if (thread.resolved) {
        parts.push(`  ✓ Resolved`);
      }
      parts.push("");
    }
  }

  // Output doc comments
  if (docComments.length > 0) {
    const docByFile = new Map<string, DocComment[]>();
    for (const comment of docComments) {
      const existing = docByFile.get(comment.file_path) || [];
      existing.push(comment);
      docByFile.set(comment.file_path, existing);
    }

    for (const [filePath, fileComments] of docByFile) {
      parts.push(`### ${filePath}`);
      for (const c of fileComments) {
        if (c.section) {
          parts.push(`- ${c.section}: ${c.body}`);
        } else {
          parts.push(`- ${c.body}`);
        }
      }
      parts.push("");
    }
  }

  // Summary
  if (verdict === "approve") {
    parts.push("### Summary");
    parts.push("LGTM. Changes look good.");
  } else if (verdict === "request_changes") {
    parts.push("### Summary");
    parts.push("Please address the above comments and request re-review.");
  }

  return parts.join("\n");
}

/** Format a single comment (thread root) for Copy Prompt */
export function formatSingleComment(comment: ReviewComment): string {
  const parts = [`${comment.file_path}:${formatLineRef(comment.line_start, comment.line_end)}`];

  if (comment.code_snippet) {
    const snippetLines = comment.code_snippet
      .split("\n")
      .map((line) => `> ${line}`);
    parts.push(...snippetLines);
  }

  parts.push("", comment.body);

  return parts.join("\n");
}
