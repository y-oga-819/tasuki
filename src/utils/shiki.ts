import { createHighlighter, type Highlighter } from "shiki";

let highlighterPromise: Promise<Highlighter> | null = null;

function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ["github-dark"],
      langs: ["typescript", "javascript", "rust", "python", "go", "tsx", "jsx"],
    });
  }
  return highlighterPromise;
}

const LANG_MAP: Record<string, string> = {
  ts: "typescript",
  tsx: "tsx",
  js: "javascript",
  jsx: "jsx",
  rs: "rust",
  py: "python",
  go: "go",
};

function detectLang(filePath: string): string {
  const ext = filePath.split(".").pop() ?? "";
  return LANG_MAP[ext] ?? "typescript";
}

/**
 * Highlight code using Shiki.
 * Returns HTML string with syntax highlighting.
 */
export async function highlightCode(code: string, filePath: string): Promise<string> {
  if (typeof window === "undefined") {
    // Node environment (Vitest) — return plain text wrapped in pre
    return `<pre><code>${escapeHtml(code)}</code></pre>`;
  }

  try {
    const highlighter = await getHighlighter();
    const lang = detectLang(filePath);
    return highlighter.codeToHtml(code, { lang, theme: "github-dark" });
  } catch {
    return `<pre><code>${escapeHtml(code)}</code></pre>`;
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
