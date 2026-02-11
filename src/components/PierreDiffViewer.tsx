import React, { useMemo, useState, useCallback, useRef } from "react";
import { PatchDiff } from "@pierre/diffs/react";
import type {
  DiffLineAnnotation,
  RenderHeaderMetadataProps,
} from "@pierre/diffs/react";
import type { SelectedLineRange } from "@pierre/diffs";
import { useStore } from "../store";
import type { FileDiff, ReviewComment } from "../types";
import { generateGitPatch, getCodeSnippet } from "../utils/diff-utils";

interface PierreDiffViewerProps {
  fileDiff: FileDiff;
}

interface CommentAnnotationMeta {
  comment: ReviewComment;
}

export const PierreDiffViewer: React.FC<PierreDiffViewerProps> = ({
  fileDiff,
}) => {
  const { diffLayout, comments, addComment } = useStore();
  const [selectedLines, setSelectedLines] = useState<SelectedLineRange | null>(
    null,
  );
  const [commentText, setCommentText] = useState("");
  const [showCommentForm, setShowCommentForm] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Generate git-format patch from Tasuki's FileDiff data
  const patch = useMemo(() => generateGitPatch(fileDiff), [fileDiff]);

  // Filter comments for this file
  const fileComments = useMemo(
    () => comments.filter((c) => c.file_path === fileDiff.file.path),
    [comments, fileDiff.file.path],
  );

  // Convert Tasuki comments to @pierre/diffs line annotations
  const lineAnnotations = useMemo(() => {
    const annotations: DiffLineAnnotation<CommentAnnotationMeta>[] = [];
    for (const comment of fileComments) {
      annotations.push({
        side: "additions",
        lineNumber: comment.line_end,
        metadata: { comment },
      });
    }
    return annotations;
  }, [fileComments]);

  // Handle line selection from @pierre/diffs
  const handleLineSelected = useCallback(
    (range: SelectedLineRange | null) => {
      setSelectedLines(range);
      if (range) {
        setShowCommentForm(false);
      }
    },
    [],
  );

  // Handle submitting a comment
  const handleSubmitComment = useCallback(() => {
    if (!commentText.trim() || !selectedLines) return;

    const lineStart = Math.min(selectedLines.start, selectedLines.end);
    const lineEnd = Math.max(selectedLines.start, selectedLines.end);
    const snippet = getCodeSnippet(fileDiff, lineStart, lineEnd);

    addComment({
      id: crypto.randomUUID(),
      file_path: fileDiff.file.path,
      line_start: lineStart,
      line_end: lineEnd,
      code_snippet: snippet,
      body: commentText.trim(),
      type: "comment",
      created_at: Date.now(),
    });

    setCommentText("");
    setSelectedLines(null);
    setShowCommentForm(false);
  }, [commentText, selectedLines, fileDiff, addComment]);

  const handleCancelComment = useCallback(() => {
    setCommentText("");
    setShowCommentForm(false);
    setSelectedLines(null);
  }, []);

  const handleStartComment = useCallback(() => {
    setShowCommentForm(true);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }, []);

  // Render annotation content for existing comments
  const renderAnnotation = useCallback(
    (annotation: DiffLineAnnotation<CommentAnnotationMeta>) => {
      const { comment } = annotation.metadata;
      return (
        <div className="pierre-annotation">
          <div className="inline-comment">
            <div className="comment-body">{comment.body}</div>
          </div>
        </div>
      );
    },
    [],
  );

  // Render custom header metadata (additions/deletions stats)
  const renderHeaderMetadata = useCallback(
    (_props: RenderHeaderMetadataProps) => {
      return (
        <span className="pierre-header-stats">
          {fileDiff.file.additions > 0 && (
            <span className="stat-added">+{fileDiff.file.additions}</span>
          )}
          {fileDiff.file.deletions > 0 && (
            <span className="stat-deleted">-{fileDiff.file.deletions}</span>
          )}
          {fileDiff.file.is_generated && (
            <span className="generated-badge">Generated</span>
          )}
        </span>
      );
    },
    [fileDiff.file.additions, fileDiff.file.deletions, fileDiff.file.is_generated],
  );

  return (
    <div className="pierre-diff-wrapper">
      <PatchDiff<CommentAnnotationMeta>
        patch={patch}
        options={{
          diffStyle: diffLayout === "split" ? "split" : "unified",
          theme: { dark: "github-dark", light: "github-light" },
          themeType: "dark",
          enableLineSelection: true,
          onLineSelected: handleLineSelected,
          diffIndicators: "classic",
          lineDiffType: "word",
          overflow: "scroll",
        }}
        selectedLines={selectedLines}
        lineAnnotations={lineAnnotations}
        renderAnnotation={renderAnnotation}
        renderHeaderMetadata={renderHeaderMetadata}
      />

      {/* Comment action bar appears when lines are selected */}
      {selectedLines && !showCommentForm && (
        <div className="pierre-comment-action-bar">
          <span className="selection-info">
            L{Math.min(selectedLines.start, selectedLines.end)}
            {selectedLines.start !== selectedLines.end &&
              `-L${Math.max(selectedLines.start, selectedLines.end)}`}
          </span>
          <button className="add-comment-btn" onClick={handleStartComment}>
            + Add comment
          </button>
        </div>
      )}

      {/* Comment form */}
      {showCommentForm && selectedLines && (
        <div className="pierre-comment-form-overlay">
          <div className="comment-form">
            <div className="comment-form-selection">
              Commenting on L{Math.min(selectedLines.start, selectedLines.end)}
              {selectedLines.start !== selectedLines.end &&
                `-L${Math.max(selectedLines.start, selectedLines.end)}`}
            </div>
            <textarea
              ref={textareaRef}
              className="comment-textarea"
              placeholder="Write a review comment..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleSubmitComment();
                }
                if (e.key === "Escape") {
                  handleCancelComment();
                }
              }}
              rows={3}
            />
            <div className="comment-form-actions">
              <button className="btn btn-secondary" onClick={handleCancelComment}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSubmitComment}
                disabled={!commentText.trim()}
              >
                Add Comment
                <kbd>Ctrl+Enter</kbd>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
