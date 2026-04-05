import React, { useCallback, useEffect, useState } from "react";
import { readFile } from "../utils/tauri-api";
import { highlightCode } from "../utils/shiki";
import s from "./CodePreviewModal.module.css";

interface CodePreviewModalProps {
  filePath: string;
  line: number;
  name: string;
  onClose: () => void;
}

const CONTEXT_LINES = 10;

export const CodePreviewModal: React.FC<CodePreviewModalProps> = ({
  filePath,
  line,
  name,
  onClose,
}) => {
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [startLine, setStartLine] = useState(0);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Prevent body scroll while modal is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Load and highlight code
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const content = await readFile(filePath);
        const lines = content.split("\n");

        // Extract context range (line is 0-based from LSP)
        const start = Math.max(0, line - CONTEXT_LINES);
        const end = Math.min(lines.length, line + CONTEXT_LINES + 1);
        const snippet = lines.slice(start, end).join("\n");

        if (cancelled) return;
        setStartLine(start);

        const highlighted = await highlightCode(snippet, filePath);
        if (cancelled) return;

        // Add highlight attribute to the target line
        const targetIndex = line - start;
        const result = addLineHighlight(highlighted, targetIndex);
        setHtml(result);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [filePath, line]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  return (
    <div className={s.modal} role="dialog" aria-label="Code preview" onClick={handleBackdropClick}>
      <div className={s.container} onClick={(e) => e.stopPropagation()}>
        <div className={s.header}>
          <span className={s.funcName}>{name}()</span>
          <span className={s.location}>
            {filePath}:{line + 1}
          </span>
          <button className={s.closeBtn} onClick={onClose} title="Close (Escape)">
            &#x2715;
          </button>
        </div>
        <div
          className={s.codeArea}
          style={{ "--start-line": startLine } as React.CSSProperties}
        >
          {error && <div className={s.error}>{error}</div>}
          {!error && !html && <div className={s.loading}>Loading...</div>}
          {html && (
            <div
              className={s.codeBlock}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          )}
        </div>
      </div>
    </div>
  );
};

/** Add data-highlight attribute to a specific line in Shiki output. */
function addLineHighlight(html: string, targetLineIndex: number): string {
  let lineIndex = 0;
  return html.replace(/<span class="line"/g, (match) => {
    const current = lineIndex;
    lineIndex++;
    if (current === targetLineIndex) {
      return '<span class="line" data-highlight="true"';
    }
    return match;
  });
}
