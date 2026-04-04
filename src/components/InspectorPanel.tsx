import React, { useEffect } from "react";
import { useInspectorStore, type MethodCard } from "../store/inspectorStore";
import { useDiffStore } from "../store/diffStore";
import { highlightCode } from "../utils/shiki";
import type { CallHierarchyCall } from "../types";
import s from "./InspectorPanel.module.css";

/** Right-pane panel showing auto-analyzed method inspections. */
export const InspectorPanel: React.FC = () => {
  const { methods, analyzing, progress, error, analyzeAll, setDefinitionHtml } =
    useInspectorStore();
  const diffResult = useDiffStore((state) => state.diffResult);

  // Auto-trigger analysis when diff data is available
  useEffect(() => {
    if (diffResult && methods.length === 0 && !analyzing && !error) {
      analyzeAll(diffResult);
    }
  }, [diffResult, methods.length, analyzing, error, analyzeAll]);

  // Highlight definition code with Shiki after methods load
  useEffect(() => {
    for (let i = 0; i < methods.length; i++) {
      const m = methods[i];
      if (m.definition_code && !m.definitionHtml) {
        highlightCode(m.definition_code, m.file_path).then((html) => {
          setDefinitionHtml(i, html);
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
          <MethodCardView key={`${method.file_path}:${method.start_line}`} method={method} index={index} />
        ))}
      </div>
    </div>
  );
};

// ---- Method Card ----

const MethodCardView: React.FC<{ method: MethodCard; index: number }> = ({ method, index }) => {
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
          {method.file_path}:{method.start_line}
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
          <CallSection title="Callers" calls={method.callers} />

          {/* Callees */}
          <CallSection title="Callees" calls={method.callees} />
        </div>
      )}
    </div>
  );
};

// ---- Call Section ----

const CallSection: React.FC<{ title: string; calls: CallHierarchyCall[] }> = ({
  title,
  calls,
}) => {
  if (calls.length === 0) return null;

  return (
    <div className={s.section}>
      <div className={s.sectionTitle}>
        {title} <span className={s.sectionCount}>({calls.length})</span>
      </div>
      <ul className={s.callList}>
        {calls.map((call, i) => (
          <li key={`${call.file_path}:${call.line}:${i}`} className={s.callItem}>
            <span className={s.callName}>{call.name}()</span>
            <span className={s.callLocation}>
              {call.file_path}:{call.line}
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
