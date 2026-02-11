import React, { useCallback } from "react";
import { useStore } from "../store";
import { formatReviewPrompt, formatSingleComment } from "../utils/format-review";
import { copyToClipboard } from "../utils/tauri-api";

export const ReviewPanel: React.FC = () => {
  const {
    comments,
    docComments,
    verdict,
    setVerdict,
    removeComment,
    removeDocComment,
  } = useStore();

  const totalComments = comments.length + docComments.length;

  const handleCopyAll = useCallback(async () => {
    const prompt = formatReviewPrompt(comments, docComments, verdict);
    await copyToClipboard(prompt);
  }, [comments, docComments, verdict]);

  const handleCopySingle = useCallback(async (commentId: string) => {
    const comment = comments.find((c) => c.id === commentId);
    if (comment) {
      const prompt = formatSingleComment(comment);
      await copyToClipboard(prompt);
    }
  }, [comments]);

  return (
    <div className="review-panel">
      <div className="review-panel-header">
        <span className="review-title">
          Review Comments
          {totalComments > 0 && (
            <span className="badge">{totalComments}</span>
          )}
        </span>
        <button
          className="btn btn-primary copy-all-btn"
          onClick={handleCopyAll}
          disabled={totalComments === 0 && !verdict}
          title="Copy all comments as structured review prompt"
        >
          Copy All
        </button>
      </div>

      {totalComments === 0 && (
        <div className="review-empty">
          <p>No comments yet. Click on line numbers in the diff to add comments.</p>
        </div>
      )}

      {/* Code comments */}
      {comments.length > 0 && (
        <ul className="comment-list">
          {comments.map((c) => (
            <li key={c.id} className="comment-item">
              <div className="comment-item-header">
                <span className="comment-location">
                  {c.file_path}:L{c.line_start}
                  {c.line_end !== c.line_start ? `-${c.line_end}` : ""}
                </span>
                <div className="comment-item-actions">
                  <button
                    className="btn-icon"
                    onClick={() => handleCopySingle(c.id)}
                    title="Copy this comment"
                  >
                    📋
                  </button>
                  <button
                    className="btn-icon"
                    onClick={() => removeComment(c.id)}
                    title="Remove comment"
                  >
                    ✕
                  </button>
                </div>
              </div>
              {c.code_snippet && (
                <pre className="comment-snippet">
                  <code>{c.code_snippet}</code>
                </pre>
              )}
              <div className="comment-body">{c.body}</div>
            </li>
          ))}
        </ul>
      )}

      {/* Doc comments */}
      {docComments.length > 0 && (
        <ul className="comment-list">
          {docComments.map((c) => (
            <li key={c.id} className="comment-item doc-comment">
              <div className="comment-item-header">
                <span className="comment-location">
                  {c.file_path}
                  {c.section ? ` — ${c.section}` : ""}
                </span>
                <button
                  className="btn-icon"
                  onClick={() => removeDocComment(c.id)}
                  title="Remove comment"
                >
                  ✕
                </button>
              </div>
              <div className="comment-body">{c.body}</div>
            </li>
          ))}
        </ul>
      )}

      {/* Verdict buttons */}
      <div className="review-verdict">
        <button
          className={`btn verdict-btn ${verdict === "approve" ? "active" : ""}`}
          onClick={() =>
            setVerdict(verdict === "approve" ? null : "approve")
          }
        >
          Approve
        </button>
        <button
          className={`btn verdict-btn request-changes ${verdict === "request_changes" ? "active" : ""}`}
          onClick={() =>
            setVerdict(
              verdict === "request_changes" ? null : "request_changes",
            )
          }
        >
          Request Changes
        </button>
      </div>
    </div>
  );
};
