import React, { useEffect, useState } from "react";
import { useInspectorStore, type MethodCard } from "../store/inspectorStore";
import { useDiffStore } from "../store/diffStore";
import { highlightCode } from "../utils/shiki";
import { CodePreviewModal } from "./CodePreviewModal";
import type { CallHierarchyCall, InspectorProgress } from "../types";
import s from "./InspectorPanel.module.css";

/** Right-pane panel showing auto-analyzed method inspections. */
interface PreviewTarget {
  filePath: string;
  line: number;
  name: string;
}

export const InspectorPanel: React.FC = () => {
  const { methods, analyzing, progress, error, analyzeAll, setDefinitionHtml } =
    useInspectorStore();
  const diffResult = useDiffStore((state) => state.diffResult);
  const [previewTarget, setPreviewTarget] = useState<PreviewTarget | null>(null);

  const updateProgress = useInspectorStore((state) => state.updateProgress);

  // Listen to inspector:progress events from Tauri backend
  useEffect(() => {
    if (typeof window === "undefined" || !("__TAURI__" in window)) return;
    let disposed = false;
    let unlistenFn: (() => void) | null = null;

    import("@tauri-apps/api/event").then(({ listen }) => {
      if (disposed) return;
      listen<InspectorProgress>("inspector:progress", (event) => {
        updateProgress(event.payload);
      }).then((fn) => {
        if (disposed) {
          fn();
        } else {
          unlistenFn = fn;
        }
      });
    });

    return () => {
      disposed = true;
      unlistenFn?.();
    };
  }, [updateProgress]);

  // Auto-trigger analysis when diff data is available
  useEffect(() => {
    if (diffResult && methods.length === 0 && !analyzing && !error) {
      analyzeAll(diffResult);
    }
  }, [diffResult, methods.length, analyzing, error, analyzeAll]);

  // Highlight definition code with Shiki after methods load
  useEffect(() => {
    for (const m of methods) {
      if (m.definition_code && !m.definitionHtml) {
        const key = `${m.file_path}:${m.start_line}`;
        highlightCode(m.definition_code, m.file_path).then((html) => {
          // Use stable key to find the method, not array index
          const current = useInspectorStore.getState().methods;
          const idx = current.findIndex(
            (c) => `${c.file_path}:${c.start_line}` === key,
          );
          if (idx >= 0 && !current[idx].definitionHtml) {
            setDefinitionHtml(idx, html);
          }
        });
      }
    }
  }, [methods, setDefinitionHtml]);

  return (
    <div className={s.panel}>
      <div className={s.header}>
        <span className={s.title}>
          Inspector
          {analyzing && <span className={s.loadingSpinner} />}
        </span>
        {analyzing && progress.total > 0 && (
          <span className={s.progressInfo}>
            {progress.done}/{progress.total}
          </span>
        )}
        {!analyzing && methods.length > 0 && (
          <span className={s.progressInfo}>
            {methods.length} method{methods.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {analyzing && progress.total > 0 && (
        <div className={s.progressBar}>
          <div
            className={s.progressFill}
            style={{ width: `${(progress.done / progress.total) * 100}%` }}
          />
        </div>
      )}

      {error && <div className={s.errorState}>{error}</div>}

      {!analyzing && !error && methods.length === 0 && (
        <div className={s.emptyState}>
          {diffResult ? "No changed methods detected" : "Waiting for diff data..."}
        </div>
      )}

      <div className={s.cardList}>
        {methods.map((method, index) => (
          <MethodCardView
            key={`${method.file_path}:${method.start_line}`}
            method={method}
            index={index}
            onPreview={setPreviewTarget}
          />
        ))}
      </div>

      {previewTarget && (
        <CodePreviewModal
          filePath={previewTarget.filePath}
          line={previewTarget.line}
          name={previewTarget.name}
          onClose={() => setPreviewTarget(null)}
        />
      )}
    </div>
  );
};

// ---- Method Card ----

const MethodCardView: React.FC<{
  method: MethodCard;
  index: number;
  onPreview: (target: PreviewTarget) => void;
}> = ({ method, index, onPreview }) => {
  const toggleCollapse = useInspectorStore((state) => state.toggleCollapse);

  const changeClass =
    method.change_type === "added"
      ? s.changeAdded
      : method.change_type === "deleted"
        ? s.changeDeleted
        : s.changeModified;

  return (
    <div className={s.card}>
      <div className={s.cardHeader} onClick={() => toggleCollapse(index)}>
        <span className={`${s.changeTag} ${changeClass}`}>{method.change_type}</span>
        <span className={s.methodName}>{method.name}()</span>
        <span className={s.filePath}>
          {method.file_path}:{method.start_line + 1}
        </span>
      </div>

      {!method.collapsed && (
        <div className={s.cardBody}>
          {method.hover_info && (
            <div className={s.hoverInfo} title={method.hover_info}>
              {method.hover_info}
            </div>
          )}

          {/* Definition code */}
          {method.definition_code && (
            <div className={s.section}>
              <div className={s.sectionTitle}>Definition</div>
              <div
                className={s.codeBlock}
                dangerouslySetInnerHTML={{
                  __html: method.definitionHtml ?? escapeHtml(method.definition_code),
                }}
              />
            </div>
          )}

          {/* Callers */}
          <CallSection title="Callers" calls={method.callers} onClickCall={onPreview} />

          {/* Callees */}
          <CallSection title="Callees" calls={method.callees} onClickCall={onPreview} />
        </div>
      )}
    </div>
  );
};

// ---- Call Section ----

const CallSection: React.FC<{
  title: string;
  calls: CallHierarchyCall[];
  onClickCall: (target: PreviewTarget) => void;
}> = ({ title, calls, onClickCall }) => {
  if (calls.length === 0) return null;

  return (
    <div className={s.section}>
      <div className={s.sectionTitle}>
        {title} <span className={s.sectionCount}>({calls.length})</span>
      </div>
      <ul className={s.callList}>
        {calls.map((call, i) => (
          <li
            key={`${call.file_path}:${call.line}:${i}`}
            className={s.callItemClickable}
            onClick={() =>
              onClickCall({
                filePath: call.file_path,
                line: call.line,
                name: call.name,
              })
            }
            title="Click to preview code"
          >
            <span className={s.callName}>{call.name}()</span>
            <span className={s.callLocation}>
              {call.file_path}:{call.line + 1}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

function escapeHtml(text: string): string {
  return `<pre><code>${text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code></pre>`;
}
