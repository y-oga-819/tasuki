import React, { useMemo, useCallback, useState } from "react";
import { PatchDiff } from "@pierre/diffs/react";
import type {
  DiffLineAnnotation,
  RenderHeaderMetadataProps,
} from "@pierre/diffs/react";
import type { SelectedLineRange, AnnotationSide } from "@pierre/diffs";
import { useStore } from "../store";
import type { CommentFormTarget } from "../store";
import type { FileDiff, ReviewComment } from "../types";
import { generateGitPatch, getCodeSnippet } from "../utils/diff-utils";

// --- Annotation metadata types ---

type AnnotationMeta =
  | { kind: "comment"; comment: ReviewComment }
  | { kind: "form"; target: CommentFormTarget };

// --- Main component ---

interface DiffViewProps {
  fileDiff: FileDiff;
}

export const DiffView: React.FC<DiffViewProps> = ({ fileDiff }) => {
  const {
    diffLayout,
    collapsedFiles,
    toggleFileCollapse,
    comments,
    addComment,
    selectedLineRange,
    setSelectedLineRange,
    commentFormTarget,
    setCommentFormTarget,
  } = useStore();

  const filePath = fileDiff.file.path;
  const isCollapsed = collapsedFiles.has(filePath);

  // Generate patch string from Tasuki data
  const patch = useMemo(() => generateGitPatch(fileDiff), [fileDiff]);

  // Map Tasuki DiffLayout → Pierre diffStyle
  const diffStyle = diffLayout === "split" ? "split" : "unified";

  // --- Comments for this file ---
  const fileComments = useMemo(
    () => comments.filter((c) => c.file_path === filePath),
    [comments, filePath],
  );

  // --- Build annotations: saved comments + active form ---
  const lineAnnotations = useMemo(() => {
    const annotations: DiffLineAnnotation<AnnotationMeta>[] = [];

    // Saved comments
    for (const comment of fileComments) {
      annotations.push({
        side: "additions",
        lineNumber: comment.line_end,
        metadata: { kind: "comment", comment },
      });
    }

    // Active comment form (injected as an annotation at the target line)
    if (commentFormTarget && commentFormTarget.filePath === filePath) {
      annotations.push({
        side: commentFormTarget.side,
        lineNumber: commentFormTarget.lineNumber,
        metadata: {
          kind: "form",
          target: commentFormTarget,
        },
      });
    }

    return annotations;
  }, [fileComments, commentFormTarget, filePath]);

  // --- Line selection handling ---
  const handleLineSelected = useCallback(
    (range: SelectedLineRange | null) => {
      setSelectedLineRange(range);
      // Close form when selection changes
      if (commentFormTarget?.filePath === filePath) {
        setCommentFormTarget(null);
      }
    },
    [setSelectedLineRange, setCommentFormTarget, commentFormTarget, filePath],
  );

  // --- Hover utility: floating "+" button to start a comment ---
  const renderHoverUtility = useCallback(
    (
      getHoveredLine: () =>
        | { lineNumber: number; side: AnnotationSide }
        | undefined,
    ) => {
      const hovered = getHoveredLine();
      if (!hovered) return null;

      // Don't show if there's already a form open on this file
      if (commentFormTarget?.filePath === filePath) return null;

      return (
        <button
          className="dv-hover-comment-btn"
          onPointerDown={(e) => {
            e.stopPropagation();
            const line = getHoveredLine();
            if (!line) return;
            setCommentFormTarget({
              filePath,
              lineNumber: line.lineNumber,
              side: line.side,
              selectionStart: line.lineNumber,
              selectionEnd: line.lineNumber,
            });
            setSelectedLineRange(null);
          }}
        >
          +
        </button>
      );
    },
    [commentFormTarget, filePath, setCommentFormTarget, setSelectedLineRange],
  );

  // --- Render annotations (both saved comments and form) ---
  const renderAnnotation = useCallback(
    (annotation: DiffLineAnnotation<AnnotationMeta>) => {
      if (annotation.metadata.kind === "comment") {
        return (
          <CommentDisplay comment={annotation.metadata.comment} />
        );
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
              addComment({
                id: crypto.randomUUID(),
                file_path: filePath,
                line_start: start,
                line_end: end,
                code_snippet: snippet,
                body,
                type: "comment",
                created_at: Date.now(),
              });
              setCommentFormTarget(null);
              setSelectedLineRange(null);
            }}
            onCancel={() => {
              setCommentFormTarget(null);
            }}
          />
        );
      }

      return null;
    },
    [fileDiff, filePath, addComment, setCommentFormTarget, setSelectedLineRange],
  );

  // --- Header metadata: stats, badges, collapse toggle ---
  const renderHeaderMetadata = useCallback(
    (_props: RenderHeaderMetadataProps) => {
      return (
        <>
          {fileDiff.file.old_path && (
            <span className="dv-renamed">{"\u2190 " + fileDiff.file.old_path}</span>
          )}
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
          <button
            className="dv-collapse-btn"
            onClick={(e) => {
              e.stopPropagation();
              toggleFileCollapse(filePath);
            }}
          >
            {"\u25BC"}
          </button>
        </>
      );
    },
    [fileDiff.file, filePath, toggleFileCollapse],
  );

  // --- selectedLines prop: use line range or selection from form target ---
  const selectedLines = useMemo(() => {
    if (commentFormTarget?.filePath === filePath) {
      return {
        start: commentFormTarget.selectionStart,
        end: commentFormTarget.selectionEnd,
        side: commentFormTarget.side,
      } satisfies SelectedLineRange;
    }
    return selectedLineRange;
  }, [selectedLineRange, commentFormTarget, filePath]);

  // --- Collapsed state: show minimal header ---
  if (isCollapsed) {
    return (
      <div className="dv-collapsed">
        <button
          className="dv-expand-btn"
          onClick={() => toggleFileCollapse(filePath)}
        >
          {"\u25B6"}
        </button>
        <span className="dv-collapsed-path">{filePath}</span>
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
    );
  }

  // --- Binary files ---
  if (fileDiff.file.is_binary) {
    return (
      <div className="dv-binary">
        <div className="dv-binary-header">{filePath}</div>
        <div className="dv-binary-body">Binary file changed</div>
      </div>
    );
  }

  // --- Full diff render via Pierre ---
  return (
    <PatchDiff<AnnotationMeta>
      patch={patch}
      options={{
        diffStyle,
        theme: { dark: "github-dark", light: "github-light" },
        themeType: "dark",
        enableLineSelection: true,
        onLineSelected: handleLineSelected,
        enableHoverUtility: true,
        expandUnchanged: true,
        diffIndicators: "classic",
        lineDiffType: "word",
        overflow: "scroll",
        hunkSeparators: "line-info",
      }}
      selectedLines={selectedLines}
      lineAnnotations={lineAnnotations}
      renderAnnotation={renderAnnotation}
      renderHeaderMetadata={renderHeaderMetadata}
      renderHoverUtility={renderHoverUtility}
    />
  );
};

// --- Sub-components ---

const CommentDisplay: React.FC<{ comment: ReviewComment }> = ({ comment }) => {
  const { removeComment } = useStore();

  return (
    <div className="dv-comment">
      <div className="dv-comment-header">
        <span className="dv-comment-location">
          L{comment.line_start}
          {comment.line_start !== comment.line_end && `-L${comment.line_end}`}
        </span>
        <span className="dv-comment-type">{comment.type}</span>
        <button
          className="dv-comment-delete"
          onClick={() => removeComment(comment.id)}
          title="Remove comment"
        >
          {"\u00D7"}
        </button>
      </div>
      {comment.code_snippet && (
        <pre className="dv-comment-snippet">{comment.code_snippet}</pre>
      )}
      <div className="dv-comment-body">{comment.body}</div>
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
          <kbd>Ctrl+Enter</kbd>
        </button>
      </div>
    </div>
  );
};
