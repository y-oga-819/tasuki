import React, { useState, useCallback, useRef } from "react";
import { useStore } from "../store";
import type { FileDiff, DiffHunk, DiffLine, ReviewComment } from "../types";
import { getCodeSnippet, getFileName } from "../utils/diff-utils";

interface DiffViewerProps {
  fileDiff: FileDiff;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({ fileDiff }) => {
  const { diffLayout, comments, addComment } = useStore();

  return (
    <div className="diff-viewer">
      <DiffFileHeader fileDiff={fileDiff} />
      {fileDiff.file.is_binary ? (
        <div className="diff-binary">Binary file changed</div>
      ) : (
        <div className={`diff-content diff-${diffLayout}`}>
          {fileDiff.hunks.map((hunk, i) => (
            <DiffHunkView
              key={i}
              hunk={hunk}
              fileDiff={fileDiff}
              layout={diffLayout}
              comments={comments.filter(
                (c) => c.file_path === fileDiff.file.path,
              )}
              onAddComment={addComment}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const DiffFileHeader: React.FC<{ fileDiff: FileDiff }> = ({ fileDiff }) => {
  const { collapsedFiles, toggleFileCollapse } = useStore();
  const isCollapsed = collapsedFiles.has(fileDiff.file.path);

  return (
    <div className="diff-file-header">
      <button
        className="collapse-toggle"
        onClick={() => toggleFileCollapse(fileDiff.file.path)}
      >
        {isCollapsed ? "▶" : "▼"}
      </button>
      <span className="diff-file-path">{fileDiff.file.path}</span>
      {fileDiff.file.old_path && (
        <span className="diff-file-renamed">
          ← {fileDiff.file.old_path}
        </span>
      )}
      <span className="diff-file-stats">
        {fileDiff.file.additions > 0 && (
          <span className="stat-added">+{fileDiff.file.additions}</span>
        )}
        {fileDiff.file.deletions > 0 && (
          <span className="stat-deleted">-{fileDiff.file.deletions}</span>
        )}
      </span>
      {fileDiff.file.is_generated && (
        <span className="generated-badge">Generated</span>
      )}
    </div>
  );
};

interface DiffHunkViewProps {
  hunk: DiffHunk;
  fileDiff: FileDiff;
  layout: "split" | "stacked";
  comments: ReviewComment[];
  onAddComment: (comment: ReviewComment) => void;
}

const DiffHunkView: React.FC<DiffHunkViewProps> = ({
  hunk,
  fileDiff,
  layout,
  comments,
  onAddComment,
}) => {
  const [commentLineStart, setCommentLineStart] = useState<number | null>(null);
  const [commentLineEnd, setCommentLineEnd] = useState<number | null>(null);
  const [commentText, setCommentText] = useState("");
  const [isSelecting, setIsSelecting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleLineClick = useCallback(
    (lineNo: number, isShift: boolean) => {
      if (isShift && commentLineStart !== null) {
        // Extend selection
        setCommentLineEnd(lineNo);
      } else {
        // Start new selection
        setCommentLineStart(lineNo);
        setCommentLineEnd(lineNo);
        setIsSelecting(true);
      }
    },
    [commentLineStart],
  );

  const handleStartComment = useCallback(() => {
    if (commentLineStart === null) return;
    setIsSelecting(false);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }, [commentLineStart]);

  const handleSubmitComment = useCallback(() => {
    if (!commentText.trim() || commentLineStart === null) return;

    const lineStart = Math.min(
      commentLineStart,
      commentLineEnd ?? commentLineStart,
    );
    const lineEnd = Math.max(
      commentLineStart,
      commentLineEnd ?? commentLineStart,
    );

    const snippet = getCodeSnippet(fileDiff, lineStart, lineEnd);

    onAddComment({
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
    setCommentLineStart(null);
    setCommentLineEnd(null);
    setIsSelecting(false);
  }, [
    commentText,
    commentLineStart,
    commentLineEnd,
    fileDiff,
    onAddComment,
  ]);

  const handleCancelComment = useCallback(() => {
    setCommentText("");
    setCommentLineStart(null);
    setCommentLineEnd(null);
    setIsSelecting(false);
  }, []);

  if (layout === "split") {
    return (
      <SplitHunk
        hunk={hunk}
        comments={comments}
        commentLineStart={commentLineStart}
        commentLineEnd={commentLineEnd}
        commentText={commentText}
        isSelecting={isSelecting}
        textareaRef={textareaRef}
        onLineClick={handleLineClick}
        onStartComment={handleStartComment}
        onSubmitComment={handleSubmitComment}
        onCancelComment={handleCancelComment}
        onCommentTextChange={setCommentText}
      />
    );
  }

  return (
    <StackedHunk
      hunk={hunk}
      comments={comments}
      commentLineStart={commentLineStart}
      commentLineEnd={commentLineEnd}
      commentText={commentText}
      isSelecting={isSelecting}
      textareaRef={textareaRef}
      onLineClick={handleLineClick}
      onStartComment={handleStartComment}
      onSubmitComment={handleSubmitComment}
      onCancelComment={handleCancelComment}
      onCommentTextChange={setCommentText}
    />
  );
};

interface HunkProps {
  hunk: DiffHunk;
  comments: ReviewComment[];
  commentLineStart: number | null;
  commentLineEnd: number | null;
  commentText: string;
  isSelecting: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onLineClick: (lineNo: number, isShift: boolean) => void;
  onStartComment: () => void;
  onSubmitComment: () => void;
  onCancelComment: () => void;
  onCommentTextChange: (text: string) => void;
}

const SplitHunk: React.FC<HunkProps> = ({
  hunk,
  comments,
  commentLineStart,
  commentLineEnd,
  commentText,
  isSelecting,
  textareaRef,
  onLineClick,
  onStartComment,
  onSubmitComment,
  onCancelComment,
  onCommentTextChange,
}) => {
  // Build split view lines: pair up old/new lines
  const oldLines: (DiffLine | null)[] = [];
  const newLines: (DiffLine | null)[] = [];

  let oi = 0;
  let ni = 0;
  const deletions: DiffLine[] = [];
  const additions: DiffLine[] = [];

  for (const line of hunk.lines) {
    if (line.origin === "-") {
      deletions.push(line);
    } else if (line.origin === "+") {
      additions.push(line);
    } else {
      // Flush paired deletions/additions
      const maxLen = Math.max(deletions.length, additions.length);
      for (let i = 0; i < maxLen; i++) {
        oldLines.push(i < deletions.length ? deletions[i] : null);
        newLines.push(i < additions.length ? additions[i] : null);
      }
      deletions.length = 0;
      additions.length = 0;
      // Context line
      oldLines.push(line);
      newLines.push(line);
    }
  }
  // Flush remaining
  const maxLen = Math.max(deletions.length, additions.length);
  for (let i = 0; i < maxLen; i++) {
    oldLines.push(i < deletions.length ? deletions[i] : null);
    newLines.push(i < additions.length ? additions[i] : null);
  }

  const isInSelection = (lineNo: number | null | undefined) => {
    if (!lineNo || commentLineStart === null) return false;
    const start = Math.min(
      commentLineStart,
      commentLineEnd ?? commentLineStart,
    );
    const end = Math.max(
      commentLineStart,
      commentLineEnd ?? commentLineStart,
    );
    return lineNo >= start && lineNo <= end;
  };

  return (
    <div className="diff-hunk">
      <div className="hunk-header">{hunk.header}</div>
      <table className="diff-table split">
        <tbody>
          {oldLines.map((oldLine, i) => {
            const newLine = newLines[i];
            const lineNo = newLine?.new_lineno ?? oldLine?.old_lineno;
            const lineComments = lineNo
              ? comments.filter(
                  (c) => lineNo >= c.line_start && lineNo <= c.line_end,
                )
              : [];

            const showCommentForm =
              !isSelecting &&
              commentLineStart !== null &&
              lineNo !== undefined &&
              lineNo ===
                Math.max(
                  commentLineStart,
                  commentLineEnd ?? commentLineStart,
                );

            return (
              <React.Fragment key={i}>
                <tr
                  className={`diff-line ${isInSelection(lineNo) ? "selected" : ""}`}
                >
                  {/* Old side */}
                  <td
                    className="line-number old"
                    onClick={(e) =>
                      oldLine?.old_lineno &&
                      onLineClick(oldLine.old_lineno, e.shiftKey)
                    }
                  >
                    {oldLine?.old_lineno ?? ""}
                  </td>
                  <td
                    className={`line-content old ${
                      oldLine?.origin === "-" ? "deletion" : ""
                    } ${!oldLine ? "empty" : ""}`}
                  >
                    {oldLine
                      ? oldLine.content.replace(/\n$/, "")
                      : ""}
                  </td>
                  {/* New side */}
                  <td
                    className="line-number new"
                    onClick={(e) =>
                      newLine?.new_lineno &&
                      onLineClick(newLine.new_lineno, e.shiftKey)
                    }
                  >
                    {newLine?.new_lineno ?? ""}
                  </td>
                  <td
                    className={`line-content new ${
                      newLine?.origin === "+" ? "addition" : ""
                    } ${!newLine ? "empty" : ""}`}
                  >
                    {newLine
                      ? newLine.content.replace(/\n$/, "")
                      : ""}
                  </td>
                </tr>
                {/* Inline comments */}
                {lineComments.map((c) => (
                  <tr key={c.id} className="comment-row">
                    <td colSpan={4}>
                      <div className="inline-comment">
                        <div className="comment-body">{c.body}</div>
                      </div>
                    </td>
                  </tr>
                ))}
                {/* Comment form */}
                {showCommentForm && (
                  <tr className="comment-form-row">
                    <td colSpan={4}>
                      <CommentForm
                        textareaRef={textareaRef}
                        commentText={commentText}
                        onCommentTextChange={onCommentTextChange}
                        onSubmit={onSubmitComment}
                        onCancel={onCancelComment}
                      />
                    </td>
                  </tr>
                )}
                {/* "Add comment" button for selected line */}
                {isSelecting &&
                  lineNo !== undefined &&
                  lineNo ===
                    Math.max(
                      commentLineStart ?? 0,
                      commentLineEnd ?? 0,
                    ) && (
                    <tr className="add-comment-row">
                      <td colSpan={4}>
                        <button
                          className="add-comment-btn"
                          onClick={onStartComment}
                        >
                          + Add comment
                        </button>
                      </td>
                    </tr>
                  )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const StackedHunk: React.FC<HunkProps> = ({
  hunk,
  comments,
  commentLineStart,
  commentLineEnd,
  commentText,
  isSelecting,
  textareaRef,
  onLineClick,
  onStartComment,
  onSubmitComment,
  onCancelComment,
  onCommentTextChange,
}) => {
  const isInSelection = (lineNo: number | null | undefined) => {
    if (!lineNo || commentLineStart === null) return false;
    const start = Math.min(
      commentLineStart,
      commentLineEnd ?? commentLineStart,
    );
    const end = Math.max(
      commentLineStart,
      commentLineEnd ?? commentLineStart,
    );
    return lineNo >= start && lineNo <= end;
  };

  return (
    <div className="diff-hunk">
      <div className="hunk-header">{hunk.header}</div>
      <table className="diff-table stacked">
        <tbody>
          {hunk.lines.map((line, i) => {
            const lineNo = line.new_lineno ?? line.old_lineno;
            const lineComments = lineNo
              ? comments.filter(
                  (c) => lineNo >= c.line_start && lineNo <= c.line_end,
                )
              : [];
            const showCommentForm =
              !isSelecting &&
              commentLineStart !== null &&
              lineNo !== undefined &&
              lineNo ===
                Math.max(
                  commentLineStart,
                  commentLineEnd ?? commentLineStart,
                );

            return (
              <React.Fragment key={i}>
                <tr
                  className={`diff-line ${line.origin === "+" ? "addition" : line.origin === "-" ? "deletion" : ""} ${isInSelection(lineNo) ? "selected" : ""}`}
                >
                  <td
                    className="line-number old"
                    onClick={(e) =>
                      line.old_lineno &&
                      onLineClick(line.old_lineno, e.shiftKey)
                    }
                  >
                    {line.old_lineno ?? ""}
                  </td>
                  <td
                    className="line-number new"
                    onClick={(e) =>
                      line.new_lineno &&
                      onLineClick(line.new_lineno, e.shiftKey)
                    }
                  >
                    {line.new_lineno ?? ""}
                  </td>
                  <td className="line-origin">{line.origin}</td>
                  <td className="line-content">
                    {line.content.replace(/\n$/, "")}
                  </td>
                </tr>
                {lineComments.map((c) => (
                  <tr key={c.id} className="comment-row">
                    <td colSpan={4}>
                      <div className="inline-comment">
                        <div className="comment-body">{c.body}</div>
                      </div>
                    </td>
                  </tr>
                ))}
                {showCommentForm && (
                  <tr className="comment-form-row">
                    <td colSpan={4}>
                      <CommentForm
                        textareaRef={textareaRef}
                        commentText={commentText}
                        onCommentTextChange={onCommentTextChange}
                        onSubmit={onSubmitComment}
                        onCancel={onCancelComment}
                      />
                    </td>
                  </tr>
                )}
                {isSelecting &&
                  lineNo !== undefined &&
                  lineNo ===
                    Math.max(
                      commentLineStart ?? 0,
                      commentLineEnd ?? 0,
                    ) && (
                    <tr className="add-comment-row">
                      <td colSpan={4}>
                        <button
                          className="add-comment-btn"
                          onClick={onStartComment}
                        >
                          + Add comment
                        </button>
                      </td>
                    </tr>
                  )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

interface CommentFormProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  commentText: string;
  onCommentTextChange: (text: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

const CommentForm: React.FC<CommentFormProps> = ({
  textareaRef,
  commentText,
  onCommentTextChange,
  onSubmit,
  onCancel,
}) => {
  return (
    <div className="comment-form">
      <textarea
        ref={textareaRef}
        className="comment-textarea"
        placeholder="Write a review comment..."
        value={commentText}
        onChange={(e) => onCommentTextChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            onSubmit();
          }
          if (e.key === "Escape") {
            onCancel();
          }
        }}
        rows={3}
      />
      <div className="comment-form-actions">
        <button className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button
          className="btn btn-primary"
          onClick={onSubmit}
          disabled={!commentText.trim()}
        >
          Add Comment
          <kbd>Ctrl+Enter</kbd>
        </button>
      </div>
    </div>
  );
};
