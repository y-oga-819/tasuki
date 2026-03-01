import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReviewStore } from "../store/reviewStore";
import { useDiffStore } from "../store/diffStore";
import { formatReviewPrompt, formatSingleComment } from "../utils/format-review";
import { copyToClipboard } from "../utils/tauri-api";
import * as api from "../utils/tauri-api";
import type { ReviewThread, DocComment } from "../types";
import s from "./ReviewPanel.module.css";

// --- Thread card for unresolved threads ---

const ThreadCard: React.FC<{
  thread: ReviewThread;
  onCopy: (thread: ReviewThread) => void;
}> = ({ thread, onCopy }) => {
  const { addReply, resolveThread, removeThread } = useReviewStore();
  const [replyText, setReplyText] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on click outside
  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMenu]);

  const c = thread.root;

  const handleReply = () => {
    if (!replyText.trim()) return;
    addReply(c.id, replyText.trim());
    setReplyText("");
  };

  const handleResolve = () => {
    if (replyText.trim()) {
      addReply(c.id, replyText.trim());
    }
    resolveThread(c.id);
    setReplyText("");
  };

  return (
    <li className={s.threadCard}>
      <div className={s.threadHeader}>
        <span className={s.commentLocation}>
          {c.file_path}:L{c.line_start}
          {c.line_end !== c.line_start ? `-${c.line_end}` : ""}
        </span>
        <div className={s.threadHeaderActions}>
          <button
            className="btn-icon"
            onClick={() => onCopy(thread)}
            title="Copy this comment"
          >
            {"\u{1F4CB}"}
          </button>
          <div className={s.menuContainer} ref={menuRef}>
            <button
              className="btn-icon"
              onClick={() => setShowMenu(!showMenu)}
              title="More actions"
            >
              {"\u2026"}
            </button>
            {showMenu && (
              <div className={s.menu}>
                <button
                  className={s.menuItemDanger}
                  onClick={() => {
                    removeThread(c.id);
                    setShowMenu(false);
                  }}
                >
                  Delete thread
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      {c.code_snippet && (
        <pre className={s.commentSnippet}>
          <code>{c.code_snippet}</code>
        </pre>
      )}
      <div className={s.commentBody}>{c.body}</div>

      {/* Replies */}
      {thread.replies.map((reply) => (
        <div key={reply.id} className={s.threadReply}>
          <span className={s.threadReplyArrow}>{"\u21B3"}</span>
          <span className={s.threadReplyBody}>{reply.body}</span>
          <span className={s.threadReplyAuthor}>{reply.author}</span>
        </div>
      ))}

      {/* Reply input + actions */}
      <div className={s.threadFooter}>
        <textarea
          className={s.threadReplyInput}
          placeholder="Write a reply..."
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleReply();
          }}
          rows={1}
        />
        <div className={s.threadActions}>
          <button
            className="btn btn-xs"
            onClick={handleReply}
            disabled={!replyText.trim()}
          >
            Reply
          </button>
          <button
            className="btn btn-primary btn-xs"
            onClick={handleResolve}
          >
            Resolve
          </button>
        </div>
      </div>
    </li>
  );
};

// --- Compact resolved thread card ---

const ResolvedThreadCard: React.FC<{
  thread: ReviewThread;
}> = ({ thread }) => {
  const { unresolveThread } = useReviewStore();
  const c = thread.root;

  return (
    <li className={`${s.threadCard} ${s.threadResolved}`}>
      <div className={s.threadHeader}>
        <span className={s.commentLocation}>
          <span className={s.resolveCheck}>{"\u2713"} </span>
          {c.file_path}:L{c.line_start}
          {c.line_end !== c.line_start ? `-${c.line_end}` : ""}
        </span>
        <button
          className="btn-icon"
          onClick={() => unresolveThread(c.id)}
          title="Reopen thread"
        >
          {"\u21A9"}
        </button>
      </div>
      <div className={s.commentBody}>{c.body}</div>
    </li>
  );
};

// --- Doc comment item (kept simpler — no thread model) ---

const DocCommentItem: React.FC<{
  comment: DocComment;
  onRemove: (id: string) => void;
  onResolve: (id: string) => void;
  onUnresolve: (id: string) => void;
}> = ({ comment, onRemove, onResolve, onUnresolve }) => {
  const c = comment;
  return (
    <li className={`${s.commentItem} ${c.resolved ? s.resolved : ""}`}>
      <div className={s.commentItemHeader}>
        <span className={s.commentLocation}>
          {c.resolved && <span className={s.resolveCheck}>{"\u2713"} </span>}
          {c.file_path}
          {c.section ? ` \u2014 ${c.section}` : ""}
        </span>
        <div className={s.commentActions}>
          {c.resolved ? (
            <button
              className="btn-icon"
              onClick={() => onUnresolve(c.id)}
              title="Reopen"
            >
              {"\u21A9"}
            </button>
          ) : (
            <button
              className="btn-icon"
              onClick={() => onResolve(c.id)}
              title="Resolve"
            >
              {"\u2713"}
            </button>
          )}
          <button
            className="btn-icon"
            onClick={() => onRemove(c.id)}
            title="Remove comment"
          >
            {"\u2715"}
          </button>
        </div>
      </div>
      <div className={s.commentBody}>{c.body}</div>
    </li>
  );
};

// --- Main ReviewPanel ---

export const ReviewPanel: React.FC = () => {
  const {
    docComments,
    verdict,
    setVerdict,
    removeDocComment,
    resolveDocComment,
    unresolveDocComment,
    gateStatus,
    setGateStatus,
    getAllThreads,
    threads,
  } = useReviewStore();
  const { diffResult } = useDiffStore();

  // eslint-disable-next-line react-hooks/exhaustive-deps -- threads triggers recomputation
  const allThreads = useMemo(() => getAllThreads(), [threads, getAllThreads]);

  const unresolvedThreads = useMemo(
    () => allThreads.filter((t) => !t.resolved),
    [allThreads],
  );

  const resolvedThreads = useMemo(
    () => allThreads.filter((t) => t.resolved),
    [allThreads],
  );

  const totalCount = allThreads.length + docComments.length;

  const unresolvedCount = useMemo(() => {
    const unresolvedDoc = docComments.filter((c) => !c.resolved).length;
    return unresolvedThreads.length + unresolvedDoc;
  }, [unresolvedThreads, docComments]);

  const canApprove = unresolvedCount === 0;

  const handleCopyAll = useCallback(async () => {
    const prompt = formatReviewPrompt(allThreads, docComments, verdict);
    await copyToClipboard(prompt);
  }, [allThreads, docComments, verdict]);

  const handleCopyThread = useCallback(
    async (thread: ReviewThread) => {
      const prompt = formatSingleComment(thread.root);
      await copyToClipboard(prompt);
    },
    [],
  );

  const writeGate = useCallback(
    async (status: "approved" | "rejected") => {
      try {
        let diffHash = "";
        if (diffResult) {
          diffHash = await api.getDiffHash(diffResult);
        }

        await api.writeCommitGate(
          status,
          diffHash,
          resolvedThreads.map((t) => ({
            file: t.root.file_path,
            line: t.root.line_start,
            body: t.root.body,
          })),
          docComments.filter((c) => c.resolved).map((c) => ({
            file: c.file_path,
            section: c.section,
            body: c.body,
          })),
        );
        setGateStatus(status);
      } catch (err) {
        console.error("Failed to write commit gate:", err);
      }
    },
    [diffResult, resolvedThreads, docComments, setGateStatus],
  );

  const handleApprove = useCallback(async () => {
    if (verdict === "approve") {
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
      <div className={s.header}>
        <span className={s.title}>
          Review Comments
          {totalCount > 0 && (
            <span className="badge">{totalCount}</span>
          )}
        </span>
        <div className={s.headerActions}>
          {gateStatus !== "none" && (
            <span className={
              gateStatus === "approved" ? s.gateApproved :
              gateStatus === "rejected" ? s.gateRejected :
              s.gateInvalidated
            }>
              {gateStatus === "approved" && "Gate: Approved"}
              {gateStatus === "rejected" && "Gate: Rejected"}
              {gateStatus === "invalidated" && "Gate: Invalidated"}
            </span>
          )}
          <button
            className={`btn btn-primary ${s.copyAllBtn}`}
            onClick={handleCopyAll}
            disabled={totalCount === 0 && !verdict}
            title="Copy all comments as structured review prompt"
          >
            Copy All
          </button>
        </div>
      </div>

      {totalCount === 0 && (
        <div className={s.empty}>
          <p>No comments yet. Click on line numbers in the diff to add comments.</p>
        </div>
      )}

      {/* Unresolved threads */}
      {unresolvedThreads.length > 0 && (
        <ul className={s.commentList}>
          {unresolvedThreads.map((t) => (
            <ThreadCard
              key={t.root.id}
              thread={t}
              onCopy={handleCopyThread}
            />
          ))}
        </ul>
      )}

      {/* Doc comments */}
      {docComments.length > 0 && (
        <ul className={s.commentList}>
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

      {/* Resolved threads (collapsible) */}
      {resolvedThreads.length > 0 && (
        <details className={s.resolvedSection}>
          <summary className={s.resolvedHeader}>
            Resolved ({resolvedThreads.length})
          </summary>
          <ul className={s.commentList}>
            {resolvedThreads.map((t) => (
              <ResolvedThreadCard key={t.root.id} thread={t} />
            ))}
          </ul>
        </details>
      )}

      {/* Verdict bar */}
      <div className={s.verdict}>
        <div className={s.verdictInfo}>
          {totalCount > 0 && (
            unresolvedCount > 0 ? (
              <span className={s.unresolvedCount}>
                Unresolved: {unresolvedCount} {unresolvedCount === 1 ? "thread" : "threads"}
              </span>
            ) : (
              <span className={s.allResolved}>
                All threads resolved
              </span>
            )
          )}
        </div>
        <div className={s.verdictButtons}>
          <button
            className={`btn ${s.verdictBtn} ${verdict === "approve" ? s.verdictBtnActive : ""}`}
            onClick={handleApprove}
            disabled={!canApprove}
            title={!canApprove ? "Resolve all threads before approving" : ""}
          >
            Approve
          </button>
          <button
            className={`btn ${s.verdictBtn} ${verdict === "request_changes" ? s.verdictBtnRejectActive : ""}`}
            onClick={handleReject}
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  );
};
