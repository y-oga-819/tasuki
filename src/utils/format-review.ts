import type { ReviewComment, DocComment, ReviewVerdict } from "../types";

/** Generate the structured review prompt for Copy All */
export function formatReviewPrompt(
  comments: ReviewComment[],
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

  // Group code comments by file
  const byFile = new Map<string, ReviewComment[]>();
  for (const comment of comments) {
    const existing = byFile.get(comment.file_path) || [];
    existing.push(comment);
    byFile.set(comment.file_path, existing);
  }

  // Output code comments
  for (const [filePath, fileComments] of byFile) {
    parts.push(`### ${filePath}`);
    for (const c of fileComments) {
      const lineRef =
        c.line_start === c.line_end
          ? `L${c.line_start}`
          : `L${c.line_start}-${c.line_end}`;

      parts.push(`- ${lineRef}`);
      if (c.code_snippet) {
        // Add code snippet as quoted block
        const snippetLines = c.code_snippet
          .split("\n")
          .map((line) => `  > ${line}`)
          .join("\n");
        parts.push(snippetLines);
      }
      parts.push(`  ${c.body}`);
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

/** Format a single comment for Copy Prompt */
export function formatSingleComment(comment: ReviewComment): string {
  const lineRef =
    comment.line_start === comment.line_end
      ? `L${comment.line_start}`
      : `L${comment.line_start}-${comment.line_end}`;

  const parts = [`${comment.file_path}:${lineRef}`];

  if (comment.code_snippet) {
    const snippetLines = comment.code_snippet
      .split("\n")
      .map((line) => `> ${line}`);
    parts.push(...snippetLines);
  }

  parts.push("", comment.body);

  return parts.join("\n");
}
