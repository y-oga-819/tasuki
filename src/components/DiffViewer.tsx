import React, { useMemo, useCallback, useState } from "react";
import { MultiFileDiff, PatchDiff, File as PierreFile } from "@pierre/diffs/react";
import type {
  DiffLineAnnotation,
} from "@pierre/diffs/react";
import type {
  SelectedLineRange,
  AnnotationSide,
  FileContents,
  FileDiffOptions,
} from "@pierre/diffs";
import { getFiletypeFromFileName, cleanLastNewline } from "@pierre/diffs";
import { useUiStore } from "../store/uiStore";
import { useDiffStore } from "../store/diffStore";
import { useEditorStore } from "../store/editorStore";
import { useReviewStore } from "../store/reviewStore";
import type { CommentFormTarget } from "../store/editorStore";

const isMac =
  typeof navigator !== "undefined" && navigator.platform.includes("Mac");
import type { FileDiff, ReviewThread } from "../types";
import { generateGitPatch, getCodeSnippet } from "../utils/diff-utils";

// --- Change type icon SVGs (from @pierre/diffs sprite) ---

const changeTypeIcons: Record<string, React.ReactNode> = {
  modified: (
    <svg viewBox="0 0 16 16" className="dv-change-icon dv-change-icon--modified">
      <path d="M1.5 8c0 1.613.088 2.806.288 3.704.196.88.478 1.381.802 1.706s.826.607 1.706.802c.898.2 2.091.288 3.704.288s2.806-.088 3.704-.288c.88-.195 1.381-.478 1.706-.802s.607-.826.802-1.706c.2-.898.288-2.091.288-3.704s-.088-2.806-.288-3.704c-.195-.88-.478-1.381-.802-1.706s-.826-.606-1.706-.802C10.806 1.588 9.613 1.5 8 1.5s-2.806.088-3.704.288c-.88.196-1.381.478-1.706.802s-.606.826-.802 1.706C1.588 5.194 1.5 6.387 1.5 8M0 8c0-6.588 1.412-8 8-8s8 1.412 8 8-1.412 8-8 8-8-1.412-8-8m8 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6" fill="currentColor"/>
    </svg>
  ),
  added: (
    <svg viewBox="0 0 16 16" className="dv-change-icon dv-change-icon--added">
      <path d="M8 4a.75.75 0 0 1 .75.75v2.5h2.5a.75.75 0 0 1 0 1.5h-2.5v2.5a.75.75 0 0 1-1.5 0v-2.5h-2.5a.75.75 0 0 1 0-1.5h2.5v-2.5A.75.75 0 0 1 8 4" fill="currentColor"/><path d="M1.788 4.296c.196-.88.478-1.381.802-1.706s.826-.606 1.706-.802C5.194 1.588 6.387 1.5 8 1.5s2.806.088 3.704.288c.88.196 1.381.478 1.706.802s.607.826.802 1.706c.2.898.288 2.091.288 3.704s-.088 2.806-.288 3.704c-.195.88-.478 1.381-.802 1.706s-.826.607-1.706.802c-.898.2-2.091.288-3.704.288s-2.806-.088-3.704-.288c-.88-.195-1.381-.478-1.706-.802s-.606-.826-.802-1.706C1.588 10.806 1.5 9.613 1.5 8s.088-2.806.288-3.704M8 0C1.412 0 0 1.412 0 8s1.412 8 8 8 8-1.412 8-8-1.412-8-8-8" fill="currentColor"/>
    </svg>
  ),
  deleted: (
    <svg viewBox="0 0 16 16" className="dv-change-icon dv-change-icon--deleted">
      <path d="M4 8a.75.75 0 0 1 .75-.75h6.5a.75.75 0 0 1 0 1.5h-6.5A.75.75 0 0 1 4 8" fill="currentColor"/><path d="M1.788 4.296c.196-.88.478-1.381.802-1.706s.826-.606 1.706-.802C5.194 1.588 6.387 1.5 8 1.5s2.806.088 3.704.288c.88.196 1.381.478 1.706.802s.607.826.802 1.706c.2.898.288 2.091.288 3.704s-.088 2.806-.288 3.704c-.195.88-.478 1.381-.802 1.706s-.826.607-1.706.802c-.898.2-2.091.288-3.704.288s-2.806-.088-3.704-.288c-.88-.195-1.381-.478-1.706-.802s-.606-.826-.802-1.706C1.588 10.806 1.5 9.613 1.5 8s.088-2.806.288-3.704M8 0C1.412 0 0 1.412 0 8s1.412 8 8 8 8-1.412 8-8-1.412-8-8-8" fill="currentColor"/>
    </svg>
  ),
  renamed: (
    <svg viewBox="0 0 16 16" className="dv-change-icon dv-change-icon--renamed">
      <path d="M1.788 4.296c.196-.88.478-1.381.802-1.706s.826-.606 1.706-.802C5.194 1.588 6.387 1.5 8 1.5s2.806.088 3.704.288c.88.196 1.381.478 1.706.802s.607.826.802 1.706c.2.898.288 2.091.288 3.704s-.088 2.806-.288 3.704c-.195.88-.478 1.381-.802 1.706s-.826.607-1.706.802c-.898.2-2.091.288-3.704.288s-2.806-.088-3.704-.288c-.88-.195-1.381-.478-1.706-.802s-.606-.826-.802-1.706C1.588 10.806 1.5 9.613 1.5 8s.088-2.806.288-3.704M8 0C1.412 0 0 1.412 0 8s1.412 8 8 8 8-1.412 8-8-1.412-8-8-8" fill="currentColor"/><path d="M8.495 4.695a.75.75 0 0 0-.05 1.06L10.486 8l-2.041 2.246a.75.75 0 0 0 1.11 1.008l2.5-2.75a.75.75 0 0 0 0-1.008l-2.5-2.75a.75.75 0 0 0-1.06-.051m-4 0a.75.75 0 0 0-.05 1.06l2.044 2.248-1.796 1.995a.75.75 0 0 0 1.114 1.004l2.25-2.5a.75.75 0 0 0-.002-1.007l-2.5-2.75a.75.75 0 0 0-1.06-.05" fill="currentColor"/>
    </svg>
  ),
};

const arrowRightIcon = (
  <svg viewBox="0 0 16 16" className="dv-rename-arrow">
    <path d="M8.47 4.22a.75.75 0 0 0 0 1.06l1.97 1.97H3.75a.75.75 0 0 0 0 1.5h6.69l-1.97 1.97a.75.75 0 1 0 1.06 1.06l3.25-3.25a.75.75 0 0 0 0-1.06L9.53 4.22a.75.75 0 0 0-1.06 0" fill="currentColor"/>
  </svg>
);

// --- Annotation metadata types ---

type AnnotationMeta =
  | { kind: "comment"; thread: ReviewThread }
  | { kind: "form"; target: CommentFormTarget };

// --- Main component ---

interface DiffViewerProps {
  fileDiff: FileDiff;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({ fileDiff }) => {
  const { diffLayout, diffOverflow, expandUnchanged } = useUiStore();
  const { collapsedFiles, toggleFileCollapse } = useDiffStore();
  const {
    selectedLineRange,
    selectedLineFile,
    setSelectedLineRange,
    commentFormTarget,
    setCommentFormTarget,
  } = useEditorStore();

  const filePath = fileDiff.file.path;

  // File-scoped thread subscription (only re-renders when THIS file's threads change)
  const fileThreads = useReviewStore(
    useCallback((s) => s.threads.get(filePath) ?? EMPTY_THREADS, [filePath]),
  );
  const addThread = useReviewStore((s) => s.addThread);

  const isCollapsed = collapsedFiles.has(filePath);

  // DiffLayout now uses Pierre-native naming directly
  const diffStyle = diffLayout;

  // Detect language via Pierre's built-in detection
  const lang = useMemo(
    () => getFiletypeFromFileName(filePath),
    [filePath],
  );

  // Build Pierre FileContents from Tasuki's old_content / new_content
  const hasFileContents = fileDiff.old_content != null || fileDiff.new_content != null;

  const oldFile = useMemo<FileContents | undefined>(() => {
    if (!hasFileContents) return undefined;
    const oldName = fileDiff.file.old_path || fileDiff.file.path;
    return {
      name: oldName,
      contents: fileDiff.old_content ? cleanLastNewline(fileDiff.old_content) : "",
      lang: lang || undefined,
    };
  }, [hasFileContents, fileDiff.old_content, fileDiff.file.old_path, fileDiff.file.path, lang]);

  const newFile = useMemo<FileContents | undefined>(() => {
    if (!hasFileContents) return undefined;
    return {
      name: fileDiff.file.path,
      contents: fileDiff.new_content ? cleanLastNewline(fileDiff.new_content) : "",
      lang: lang || undefined,
    };
  }, [hasFileContents, fileDiff.new_content, fileDiff.file.path, lang]);

  // Fallback: generate patch string only when file contents are unavailable
  const patch = useMemo(
    () => (hasFileContents ? "" : generateGitPatch(fileDiff)),
    [hasFileContents, fileDiff],
  );

  // --- Build annotations: saved threads + active form ---
  const lineAnnotations = useMemo(() => {
    const annotations: DiffLineAnnotation<AnnotationMeta>[] = [];

    for (const thread of fileThreads) {
      annotations.push({
        side: "additions",
        lineNumber: thread.root.line_end,
        metadata: { kind: "comment", thread },
      });
    }

    if (commentFormTarget && commentFormTarget.filePath === filePath) {
      annotations.push({
        side: commentFormTarget.side,
        lineNumber: commentFormTarget.lineNumber,
        metadata: { kind: "form", target: commentFormTarget },
      });
    }

    return annotations;
  }, [fileThreads, commentFormTarget, filePath]);

  // --- Line selection handling ---
  const handleLineSelected = useCallback(
    (range: SelectedLineRange | null) => {
      setSelectedLineRange(range, range ? filePath : null);
    },
    [setSelectedLineRange, filePath],
  );

  // --- Hover utility: floating "+" button ---
  const renderHoverUtility = useCallback(
    (
      getHoveredLine: () =>
        | { lineNumber: number; side: AnnotationSide }
        | undefined,
    ) => {
      const hovered = getHoveredLine();
      if (!hovered) return null;
      if (commentFormTarget?.filePath === filePath) return null;

      return (
        <button
          className="dv-hover-comment-btn"
          onPointerDown={(e) => {
            e.stopPropagation();
            const line = getHoveredLine();
            if (!line) return;

            if (selectedLineRange && selectedLineFile === filePath && selectedLineRange.start !== selectedLineRange.end) {
              const start = Math.min(selectedLineRange.start, selectedLineRange.end);
              const end = Math.max(selectedLineRange.start, selectedLineRange.end);
              setCommentFormTarget({
                filePath,
                lineNumber: end,
                side: selectedLineRange.side ?? line.side,
                selectionStart: start,
                selectionEnd: end,
              });
            } else {
              setCommentFormTarget({
                filePath,
                lineNumber: line.lineNumber,
                side: line.side,
                selectionStart: line.lineNumber,
                selectionEnd: line.lineNumber,
              });
            }
            setSelectedLineRange(null);
          }}
        >
          +
        </button>
      );
    },
    [commentFormTarget, selectedLineRange, selectedLineFile, filePath, setCommentFormTarget, setSelectedLineRange],
  );

  // --- Render annotations ---
  const renderAnnotation = useCallback(
    (annotation: DiffLineAnnotation<AnnotationMeta>) => {
      if (annotation.metadata.kind === "comment") {
        return <ThreadDisplay thread={annotation.metadata.thread} />;
      }

      if (annotation.metadata.kind === "form") {
        return (
          <CommentFormInline
            fileDiff={fileDiff}
            target={annotation.metadata.target}
            onSubmit={(body) => {
              const t = annotation.metadata as { kind: "form"; target: CommentFormTarget };
              const start = Math.min(t.target.selectionStart, t.target.selectionEnd);
              const end = Math.max(t.target.selectionStart, t.target.selectionEnd);
              const snippet = getCodeSnippet(fileDiff, start, end);
              addThread(filePath, {
                id: crypto.randomUUID(),
                file_path: filePath,
                line_start: start,
                line_end: end,
                code_snippet: snippet,
                body,
                type: "comment",
                created_at: Date.now(),
                author: "human",
              });
              setCommentFormTarget(null);
              setSelectedLineRange(null);
            }}
            onCancel={() => setCommentFormTarget(null)}
          />
        );
      }

      return null;
    },
    [fileDiff, filePath, addThread, setCommentFormTarget, setSelectedLineRange],
  );

  // --- selectedLines prop ---
  const selectedLines = useMemo(() => {
    if (commentFormTarget?.filePath === filePath) {
      return {
        start: commentFormTarget.selectionStart,
        end: commentFormTarget.selectionEnd,
        side: commentFormTarget.side,
      } satisfies SelectedLineRange;
    }
    if (selectedLineFile === filePath) {
      return selectedLineRange;
    }
    return null;
  }, [selectedLineRange, selectedLineFile, commentFormTarget, filePath]);

  // --- Shared Pierre options ---
  const options = useMemo<FileDiffOptions<AnnotationMeta>>(
    () => ({
      diffStyle,
      theme: { dark: "github-dark", light: "github-light" },
      themeType: "dark",
      disableFileHeader: true,
      enableLineSelection: true,
      onLineSelected: handleLineSelected,
      enableHoverUtility: true,
      expandUnchanged,
      diffIndicators: "bars",
      lineDiffType: "word-alt",
      overflow: diffOverflow,
      hunkSeparators: "metadata",
    }),
    [diffStyle, diffOverflow, expandUnchanged, handleLineSelected],
  );

  // Shared render props
  const sharedProps = {
    options,
    selectedLines,
    lineAnnotations,
    renderAnnotation,
    renderHoverUtility,
  };

  // --- Custom file header (shared between collapsed and expanded) ---
  const fileStatus = fileDiff.file.status;
  const changeIcon = changeTypeIcons[fileStatus] ?? changeTypeIcons.modified;

  const fileHeader = (
    <div className="dv-file-header" onClick={() => toggleFileCollapse(filePath)}>
      <div className="dv-header-left">
        <span className="dv-toggle">{isCollapsed ? "\u25B6" : "\u25BC"}</span>
        {changeIcon}
        {fileDiff.file.old_path && (
          <>
            <span className="dv-file-path">{fileDiff.file.old_path}</span>
            {arrowRightIcon}
          </>
        )}
        <span className="dv-file-path">{filePath}</span>
      </div>
      <div className="dv-header-right">
        <span className="dv-stats">
          {fileDiff.file.additions > 0 && (
            <span className="dv-stat-add">+{fileDiff.file.additions}</span>
          )}
          {fileDiff.file.deletions > 0 && (
            <span className="dv-stat-del">-{fileDiff.file.deletions}</span>
          )}
        </span>
        {fileDiff.file.is_generated && (
          <span className="dv-generated">Generated</span>
        )}
      </div>
    </div>
  );

  // --- Binary ---
  if (fileDiff.file.is_binary) {
    return (
      <div className="dv-binary">
        {fileHeader}
        {!isCollapsed && (
          <div className="dv-binary-body">Binary file changed</div>
        )}
      </div>
    );
  }

  // --- Render: new files use Pierre File component for cleaner display ---
  if (fileDiff.file.status === "added" && newFile) {
    return (
      <div>
        {fileHeader}
        {!isCollapsed && (
          <PierreFile
            file={newFile}
            options={{
              theme: { dark: "github-dark", light: "github-light" },
              themeType: "dark",
              disableFileHeader: true,
              overflow: diffOverflow,
            }}
            selectedLines={selectedLines}
          />
        )}
      </div>
    );
  }

  // --- Render: prefer MultiFileDiff (file contents), fallback to PatchDiff ---
  if (hasFileContents && oldFile && newFile) {
    return (
      <div>
        {fileHeader}
        {!isCollapsed && (
          <MultiFileDiff<AnnotationMeta>
            oldFile={oldFile}
            newFile={newFile}
            {...sharedProps}
          />
        )}
      </div>
    );
  }

  return (
    <div>
      {fileHeader}
      {!isCollapsed && (
        <PatchDiff<AnnotationMeta>
          patch={patch}
          {...sharedProps}
        />
      )}
    </div>
  );
};

// --- Empty array singleton ---
const EMPTY_THREADS: ReviewThread[] = [];

// --- Sub-components ---

const ThreadDisplay: React.FC<{ thread: ReviewThread }> = ({ thread }) => {
  const { removeThread } = useReviewStore();
  const comment = thread.root;

  return (
    <div className={`dv-comment ${thread.resolved ? "dv-comment--resolved" : ""}`}>
      <div className="dv-comment-header">
        <span className="dv-comment-location">
          L{comment.line_start}
          {comment.line_start !== comment.line_end && `-L${comment.line_end}`}
        </span>
        <span className="dv-comment-type">{comment.type}</span>
        <button
          className="dv-comment-delete"
          onClick={() => removeThread(comment.id)}
          title="Remove comment"
        >
          {"\u00D7"}
        </button>
      </div>
      {comment.code_snippet && !thread.resolved && (
        <pre className="dv-comment-snippet">{comment.code_snippet}</pre>
      )}
      <div className="dv-comment-body">{comment.body}</div>
      {thread.replies.map((reply) => (
        <div key={reply.id} className="dv-comment-reply">
          <span className="dv-reply-arrow">{"\u21B3"}</span>
          <span className="dv-reply-body">{reply.body}</span>
          <span className="dv-reply-author">{reply.author}</span>
        </div>
      ))}
    </div>
  );
};

const CommentFormInline: React.FC<{
  fileDiff: FileDiff;
  target: CommentFormTarget;
  onSubmit: (body: string) => void;
  onCancel: () => void;
}> = ({ target, onSubmit, onCancel }) => {
  const [text, setText] = useState("");

  return (
    <div className="dv-comment-form">
      <div className="dv-form-header">
        L{Math.min(target.selectionStart, target.selectionEnd)}
        {target.selectionStart !== target.selectionEnd &&
          `-L${Math.max(target.selectionStart, target.selectionEnd)}`}
      </div>
      <textarea
        className="dv-form-textarea"
        autoFocus
        placeholder="Write a review comment..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            if (text.trim()) onSubmit(text.trim());
          }
          if (e.key === "Escape") {
            onCancel();
          }
        }}
        rows={3}
      />
      <div className="dv-form-actions">
        <button className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button
          className="btn btn-primary"
          onClick={() => text.trim() && onSubmit(text.trim())}
          disabled={!text.trim()}
        >
          Add Comment
          <kbd>{isMac ? "Cmd" : "Ctrl"}+Enter</kbd>
        </button>
      </div>
    </div>
  );
};
