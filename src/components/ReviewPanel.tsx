import React, { useCallback, useMemo, useState } from "react";
import { useReviewStore } from "../store/reviewStore";
import { useDiffStore } from "../store/diffStore";
import { formatReviewPrompt, formatSingleComment } from "../utils/format-review";
import { copyToClipboard } from "../utils/tauri-api";
import * as api from "../utils/tauri-api";
import type { ReviewComment, DocComment } from "../types";

/** Inline form for entering a resolution memo */
const ResolveMemoForm: React.FC<{
  onConfirm: (memo: string | null) => void;
  onCancel: () => void;
}> = ({ onConfirm, onCancel }) => {
  const [memo, setMemo] = useState("");
  return (
    <div className="resolve-form">
      <input
        className="resolve-memo-input"
        type="text"
        placeholder="解決メモ（任意）"
        value={memo}
        onChange={(e) => setMemo(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onConfirm(memo || null);
          if (e.key === "Escape") onCancel();
        }}
        autoFocus
      />
      <div className="resolve-form-actions">
        <button className="btn btn-primary btn-xs" onClick={() => onConfirm(memo || null)}>
          確定
        </button>
        <button className="btn btn-xs" onClick={onCancel}>
          取消
        </button>
      </div>
    </div>
  );
};

/** A single code comment item with resolve/unresolve support */
const CodeCommentItem: React.FC<{
  comment: ReviewComment;
  onCopy: (id: string) => void;
  onRemove: (id: string) => void;
  onResolve: (id: string, memo: string | null) => void;
  onUnresolve: (id: string) => void;
}> = ({ comment, onCopy, onRemove, onResolve, onUnresolve }) => {
  const c = comment;
  return (
    <li className={`comment-item ${c.resolved ? "resolved" : ""}`}>
      <div className="comment-item-header">
        <span className="comment-location">
          {c.resolved && <span className="resolve-check">&#10003; </span>}
          {c.file_path}:L{c.line_start}
          {c.line_end !== c.line_start ? `-${c.line_end}` : ""}
        </span>
        <div className="comment-item-actions">
          {c.resolved && (
            <button
              className="btn-icon"
              onClick={() => onUnresolve(c.id)}
              title="解決を取り消し"
            >
              &#x21A9;
            </button>
          )}
          {!c.resolved && (
            <button
              className="btn-icon"
              onClick={() => onCopy(c.id)}
              title="Copy this comment"
            >
              &#x1F4CB;
            </button>
          )}
          <button
            className="btn-icon"
            onClick={() => onRemove(c.id)}
            title="Remove comment"
          >
            &#x2715;
          </button>
        </div>
      </div>
      {c.code_snippet && !c.resolved && (
        <pre className="comment-snippet">
          <code>{c.code_snippet}</code>
        </pre>
      )}
      <div className="comment-body">{c.body}</div>
      {c.resolved && c.resolution_memo && (
        <div className="resolution-memo">解決メモ: {c.resolution_memo}</div>
      )}
      {!c.resolved && (
        <ResolveMemoForm
          onConfirm={(memo) => onResolve(c.id, memo)}
          onCancel={() => {}}
        />
      )}
    </li>
  );
};

/** A single doc comment item with resolve/unresolve support */
const DocCommentItem: React.FC<{
  comment: DocComment;
  onRemove: (id: string) => void;
  onResolve: (id: string, memo: string | null) => void;
  onUnresolve: (id: string) => void;
}> = ({ comment, onRemove, onResolve, onUnresolve }) => {
  const c = comment;
  return (
    <li className={`comment-item doc-comment ${c.resolved ? "resolved" : ""}`}>
      <div className="comment-item-header">
        <span className="comment-location">
          {c.resolved && <span className="resolve-check">&#10003; </span>}
          {c.file_path}
          {c.section ? ` — ${c.section}` : ""}
        </span>
        <div className="comment-item-actions">
          {c.resolved && (
            <button
              className="btn-icon"
              onClick={() => onUnresolve(c.id)}
              title="解決を取り消し"
            >
              &#x21A9;
            </button>
          )}
          <button
            className="btn-icon"
            onClick={() => onRemove(c.id)}
            title="Remove comment"
          >
            &#x2715;
          </button>
        </div>
      </div>
      <div className="comment-body">{c.body}</div>
      {c.resolved && c.resolution_memo && (
        <div className="resolution-memo">解決メモ: {c.resolution_memo}</div>
      )}
      {!c.resolved && (
        <ResolveMemoForm
          onConfirm={(memo) => onResolve(c.id, memo)}
          onCancel={() => {}}
        />
      )}
    </li>
  );
};

export const ReviewPanel: React.FC = () => {
  const {
    comments,
    docComments,
    verdict,
    setVerdict,
    removeComment,
    removeDocComment,
    resolveComment,
    unresolveComment,
    resolveDocComment,
    unresolveDocComment,
    gateStatus,
    setGateStatus,
  } = useReviewStore();
  const { diffResult } = useDiffStore();

  const totalComments = comments.length + docComments.length;

  const unresolvedCount = useMemo(() => {
    const unresolvedCode = comments.filter((c) => !c.resolved).length;
    const unresolvedDoc = docComments.filter((c) => !c.resolved).length;
    return unresolvedCode + unresolvedDoc;
  }, [comments, docComments]);

  const resolvedComments = useMemo(() => comments.filter((c) => c.resolved), [comments]);
  const resolvedDocComments = useMemo(() => docComments.filter((c) => c.resolved), [docComments]);

  const canApprove = unresolvedCount === 0;

  const handleCopyAll = useCallback(async () => {
    const prompt = formatReviewPrompt(comments, docComments, verdict);
    await copyToClipboard(prompt);
  }, [comments, docComments, verdict]);

  const handleCopySingle = useCallback(
    async (commentId: string) => {
      const comment = comments.find((c) => c.id === commentId);
      if (comment) {
        const prompt = formatSingleComment(comment);
        await copyToClipboard(prompt);
      }
    },
    [comments],
  );

  const writeGate = useCallback(
    async (status: "approved" | "rejected") => {
      try {
        // Get diff_hash from current diffResult
        let diffHash = "";
        if (diffResult) {
          diffHash = await api.getDiffHash(diffResult);
        }

        await api.writeCommitGate(
          status,
          diffHash,
          resolvedComments.map((c) => ({
            file: c.file_path,
            line: c.line_start,
            body: c.body,
            resolution_memo: c.resolution_memo,
          })),
          resolvedDocComments.map((c) => ({
            file: c.file_path,
            section: c.section,
            body: c.body,
            resolution_memo: c.resolution_memo,
          })),
        );
        setGateStatus(status);
      } catch (err) {
        console.error("Failed to write commit gate:", err);
      }
    },
    [diffResult, resolvedComments, resolvedDocComments, setGateStatus],
  );

  const handleApprove = useCallback(async () => {
    if (verdict === "approve") {
      // Toggle off
      setVerdict(null);
      try {
        await api.clearCommitGate();
      } catch { /* ignore */ }
      setGateStatus("none");
    } else {
      setVerdict("approve");
      await writeGate("approved");
    }
  }, [verdict, setVerdict, writeGate, setGateStatus]);

  const handleReject = useCallback(async () => {
    if (verdict === "request_changes") {
      // Toggle off
      setVerdict(null);
      try {
        await api.clearCommitGate();
      } catch { /* ignore */ }
      setGateStatus("none");
    } else {
      setVerdict("request_changes");
      await writeGate("rejected");
    }
  }, [verdict, setVerdict, writeGate, setGateStatus]);

  return (
    <div className="review-panel">
      <div className="review-panel-header">
        <span className="review-title">
          Review Comments
          {totalComments > 0 && (
            <span className="badge">{totalComments}</span>
          )}
        </span>
        <div className="review-header-actions">
          {gateStatus !== "none" && (
            <span className={`gate-badge gate-${gateStatus}`}>
              {gateStatus === "approved" && "Gate: Approved"}
              {gateStatus === "rejected" && "Gate: Rejected"}
              {gateStatus === "invalidated" && "Gate: Invalidated"}
            </span>
          )}
          <button
            className="btn btn-primary copy-all-btn"
            onClick={handleCopyAll}
            disabled={totalComments === 0 && !verdict}
            title="Copy all comments as structured review prompt"
          >
            Copy All
          </button>
        </div>
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
            <CodeCommentItem
              key={c.id}
              comment={c}
              onCopy={handleCopySingle}
              onRemove={removeComment}
              onResolve={resolveComment}
              onUnresolve={unresolveComment}
            />
          ))}
        </ul>
      )}

      {/* Doc comments */}
      {docComments.length > 0 && (
        <ul className="comment-list">
          {docComments.map((c) => (
            <DocCommentItem
              key={c.id}
              comment={c}
              onRemove={removeDocComment}
              onResolve={resolveDocComment}
              onUnresolve={unresolveDocComment}
            />
          ))}
        </ul>
      )}

      {/* Unresolved count + Verdict buttons */}
      <div className="review-verdict">
        <div className="verdict-info">
          {totalComments > 0 && (
            unresolvedCount > 0 ? (
              <span className="unresolved-count">
                未解決: {unresolvedCount}件
              </span>
            ) : (
              <span className="all-resolved">
                全コメント解決済み
              </span>
            )
          )}
        </div>
        <div className="verdict-buttons">
          <button
            className={`btn verdict-btn ${verdict === "approve" ? "active" : ""}`}
            onClick={handleApprove}
            disabled={!canApprove}
            title={!canApprove ? "全コメントを解決してからApproveしてください" : ""}
          >
            Approve
          </button>
          <button
            className={`btn verdict-btn request-changes ${verdict === "request_changes" ? "active" : ""}`}
            onClick={handleReject}
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  );
};
