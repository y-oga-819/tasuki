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
import s from "./DiffViewer.module.css";

const isMac =
  typeof navigator !== "undefined" && navigator.platform.includes("Mac");
import type { FileDiff, ReviewThread } from "../types";
import { generateGitPatch, getCodeSnippet } from "../utils/diff-utils";

// --- Change type icon SVGs (from @pierre/diffs sprite) ---

const changeTypeIcons: Record<string, React.ReactNode> = {
  modified: (
    <svg viewBox="0 0 16 16" className={s.changeIconModified}>
      <path d="M1.5 8c0 1.613.088 2.806.288 3.704.196.88.478 1.381.802 1.706s.826.607 1.706.802c.898.2 2.091.288 3.704.288s2.806-.088 3.704-.288c.88-.195 1.381-.478 1.706-.802s.607-.826.802-1.706c.2-.898.288-2.091.288-3.704s-.088-2.806-.288-3.704c-.195-.88-.478-1.381-.802-1.706s-.826-.606-1.706-.802C10.806 1.588 9.613 1.5 8 1.5s-2.806.088-3.704.288c-.88.196-1.381.478-1.706.802s-.606.826-.802 1.706C1.588 5.194 1.5 6.387 1.5 8M0 8c0-6.588 1.412-8 8-8s8 1.412 8 8-1.412 8-8 8-8-1.412-8-8m8 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6" fill="currentColor"/>
    </svg>
  ),
  added: (
    <svg viewBox="0 0 16 16" className={s.changeIconAdded}>
      <path d="M8 4a.75.75 0 0 1 .75.75v2.5h2.5a.75.75 0 0 1 0 1.5h-2.5v2.5a.75.75 0 0 1-1.5 0v-2.5h-2.5a.75.75 0 0 1 0-1.5h2.5v-2.5A.75.75 0 0 1 8 4" fill="currentColor"/><path d="M1.788 4.296c.196-.88.478-1.381.802-1.706s.826-.606 1.706-.802C5.194 1.588 6.387 1.5 8 1.5s2.806.088 3.704.288c.88.196 1.381.478 1.706.802s.607.826.802 1.706c.2.898.288 2.091.288 3.704s-.088 2.806-.288 3.704c-.195.88-.478 1.381-.802 1.706s-.826.607-1.706.802c-.898.2-2.091.288-3.704.288s-2.806-.088-3.704-.288c-.88-.195-1.381-.478-1.706-.802s-.606-.826-.802-1.706C1.588 10.806 1.5 9.613 1.5 8s.088-2.806.288-3.704M8 0C1.412 0 0 1.412 0 8s1.412 8 8 8 8-1.412 8-8-1.412-8-8-8" fill="currentColor"/>
    </svg>
  ),
  deleted: (
    <svg viewBox="0 0 16 16" className={s.changeIconDeleted}>
      <path d="M4 8a.75.75 0 0 1 .75-.75h6.5a.75.75 0 0 1 0 1.5h-6.5A.75.75 0 0 1 4 8" fill="currentColor"/><path d="M1.788 4.296c.196-.88.478-1.381.802-1.706s.826-.606 1.706-.802C5.194 1.588 6.387 1.5 8 1.5s2.806.088 3.704.288c.88.196 1.381.478 1.706.802s.607.826.802 1.706c.2.898.288 2.091.288 3.704s-.088 2.806-.288 3.704c-.195.88-.478 1.381-.802 1.706s-.826.607-1.706.802c-.898.2-2.091.288-3.704.288s-2.806-.088-3.704-.288c-.88-.195-1.381-.478-1.706-.802s-.606-.826-.802-1.706C1.588 10.806 1.5 9.613 1.5 8s.088-2.806.288-3.704M8 0C1.412 0 0 1.412 0 8s1.412 8 8 8 8-1.412 8-8-1.412-8-8-8" fill="currentColor"/>
    </svg>
  ),
  renamed: (
    <svg viewBox="0 0 16 16" className={s.changeIconRenamed}>
      <path d="M1.788 4.296c.196-.88.478-1.381.802-1.706s.826-.606 1.706-.802C5.194 1.588 6.387 1.5 8 1.5s2.806.088 3.704.288c.88.196 1.381.478 1.706.802s.607.826.802 1.706c.2.898.288 2.091.288 3.704s-.088 2.806-.288 3.704c-.195.88-.478 1.381-.802 1.706s-.826.607-1.706.802c-.898.2-2.091.288-3.704.288s-2.806-.088-3.704-.288c-.88-.195-1.381-.478-1.706-.802s-.606-.826-.802-1.706C1.588 10.806 1.5 9.613 1.5 8s.088-2.806.288-3.704M8 0C1.412 0 0 1.412 0 8s1.412 8 8 8 8-1.412 8-8-1.412-8-8-8" fill="currentColor"/><path d="M8.495 4.695a.75.75 0 0 0-.05 1.06L10.486 8l-2.041 2.246a.75.75 0 0 0 1.11 1.008l2.5-2.75a.75.75 0 0 0 0-1.008l-2.5-2.75a.75.75 0 0 0-1.06-.051m-4 0a.75.75 0 0 0-.05 1.06l2.044 2.248-1.796 1.995a.75.75 0 0 0 1.114 1.004l2.25-2.5a.75.75 0 0 0-.002-1.007l-2.5-2.75a.75.75 0 0 0-1.06-.05" fill="currentColor"/>
    </svg>
  ),
};

const arrowRightIcon = (
  <svg viewBox="0 0 16 16" className={s.renameArrow}>
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

export const DiffViewer = React.memo<DiffViewerProps>(function DiffViewer({ fileDiff }) {
  const filePath = fileDiff.file.path;

  // File-scoped selectors: primitives/null for non-matching files to avoid cross-file re-renders
  const isCollapsed = useDiffStore(
    useCallback((s) => s.collapsedFiles.has(filePath), [filePath]),
  );
  const toggleFileCollapse = useDiffStore((s) => s.toggleFileCollapse);
  const commentFormTarget = useEditorStore(
    useCallback(
      (s) => s.commentFormTarget?.filePath === filePath ? s.commentFormTarget : null,
      [filePath],
    ),
  );
  const setCommentFormTarget = useEditorStore((s) => s.setCommentFormTarget);
  const lineSelection = useEditorStore((s) => s.lineSelection);
  const setLineSelection = useEditorStore((s) => s.setLineSelection);
  const fileThreads = useReviewStore(
    useCallback((s) => s.threads.get(filePath) ?? EMPTY_THREADS, [filePath]),
  );
  const addThread = useReviewStore((s) => s.addThread);

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
  const lineAnnotations = useMemo(
    () => buildAnnotations(fileThreads, commentFormTarget, filePath),
    [fileThreads, commentFormTarget, filePath],
  );

  // --- Line selection handling ---
  const handleLineSelected = useCallback(
    (range: SelectedLineRange | null) => {
      setLineSelection(range, range ? filePath : null);
    },
    [setLineSelection, filePath],
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
      if (commentFormTarget) return null;

      return (
        <button
          className={s.hoverBtn}
          onPointerDown={(e) => {
            e.stopPropagation();
            const line = getHoveredLine();
            if (!line) return;

            if (lineSelection && lineSelection.file === filePath && lineSelection.range.start !== lineSelection.range.end) {
              const start = Math.min(lineSelection.range.start, lineSelection.range.end);
              const end = Math.max(lineSelection.range.start, lineSelection.range.end);
              setCommentFormTarget({
                filePath,
                lineNumber: end,
                side: lineSelection.range.side ?? line.side,
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
            setLineSelection(null);
          }}
        >
          +
        </button>
      );
    },
    [commentFormTarget, lineSelection, filePath, setCommentFormTarget, setLineSelection],
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
              setLineSelection(null);
            }}
            onCancel={() => setCommentFormTarget(null)}
          />
        );
      }

      return null;
    },
    [fileDiff, filePath, addThread, setCommentFormTarget, setLineSelection],
  );

  // --- selectedLines prop ---
  const selectedLines = useMemo(() => {
    if (commentFormTarget) {
      return {
        start: commentFormTarget.selectionStart,
        end: commentFormTarget.selectionEnd,
        side: commentFormTarget.side,
      } satisfies SelectedLineRange;
    }
    if (lineSelection?.file === filePath) {
      return lineSelection.range;
    }
    return null;
  }, [lineSelection, commentFormTarget, filePath]);

  // --- Shared Pierre options (UI-only deps, stable across comment changes) ---
  const options = usePierreOptions(handleLineSelected);

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
      <div className={s.headerLeft}>
        <span className={s.toggle}>{isCollapsed ? "\u25B6" : "\u25BC"}</span>
        {changeIcon}
        {fileDiff.file.old_path && (
          <>
            <span className={s.filePath}>{fileDiff.file.old_path}</span>
            {arrowRightIcon}
          </>
        )}
        <span className={s.filePath}>{filePath}</span>
      </div>
      <div className={s.headerRight}>
        <span className={s.stats}>
          {fileDiff.file.additions > 0 && (
            <span className={s.statAdd}>+{fileDiff.file.additions}</span>
          )}
          {fileDiff.file.deletions > 0 && (
            <span className={s.statDel}>-{fileDiff.file.deletions}</span>
          )}
        </span>
        {fileDiff.file.is_generated && (
          <span className={s.generated}>Generated</span>
        )}
      </div>
    </div>
  );

  // --- Binary ---
  if (fileDiff.file.is_binary) {
    return (
      <div className={s.binary}>
        {fileHeader}
        {!isCollapsed && (
          <div className={s.binaryBody}>Binary file changed</div>
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
              overflow: options.overflow,
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
});

// --- Empty array singleton ---
const EMPTY_THREADS: ReviewThread[] = [];

// --- Pure function: build annotations from threads + active form ---
function buildAnnotations(
  fileThreads: ReviewThread[],
  commentFormTarget: CommentFormTarget | null,
  filePath: string,
): DiffLineAnnotation<AnnotationMeta>[] {
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
}

// --- Hook: Pierre options with UI-only dependencies ---
function usePierreOptions(
  onLineSelected: (range: SelectedLineRange | null) => void,
): FileDiffOptions<AnnotationMeta> {
  const diffStyle = useUiStore((s) => s.diffLayout);
  const overflow = useUiStore((s) => s.diffOverflow);
  const expandUnchanged = useUiStore((s) => s.expandUnchanged);

  return useMemo(() => ({
    diffStyle,
    theme: { dark: "github-dark", light: "github-light" },
    themeType: "dark",
    disableFileHeader: true,
    enableLineSelection: true,
    onLineSelected,
    enableHoverUtility: true,
    expandUnchanged,
    diffIndicators: "bars",
    lineDiffType: "word-alt",
    overflow,
    hunkSeparators: "metadata",
  }), [diffStyle, overflow, expandUnchanged, onLineSelected]);
}

// --- Sub-components ---

const ThreadDisplay: React.FC<{ thread: ReviewThread }> = ({ thread }) => {
  const { removeThread } = useReviewStore();
  const comment = thread.root;

  return (
    <div className={`${s.comment} ${thread.resolved ? s.resolved : ""}`}>
      <div className={s.commentHeader}>
        <span className={s.commentLocation}>
          L{comment.line_start}
          {comment.line_start !== comment.line_end && `-L${comment.line_end}`}
        </span>
        <span className={s.commentType}>{comment.type}</span>
        <button
          className={s.commentDelete}
          onClick={() => removeThread(comment.id)}
          title="Remove comment"
        >
          {"\u00D7"}
        </button>
      </div>
      {comment.code_snippet && !thread.resolved && (
        <pre className={s.commentSnippet}>{comment.code_snippet}</pre>
      )}
      <div className={s.commentBody}>{comment.body}</div>
      {thread.replies.map((reply) => (
        <div key={reply.id} className={s.commentReply}>
          <span className={s.replyArrow}>{"\u21B3"}</span>
          <span className={s.replyBody}>{reply.body}</span>
          <span className={s.replyAuthor}>{reply.author}</span>
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
    <div className={s.commentForm}>
      <div className={s.formHeader}>
        L{Math.min(target.selectionStart, target.selectionEnd)}
        {target.selectionStart !== target.selectionEnd &&
          `-L${Math.max(target.selectionStart, target.selectionEnd)}`}
      </div>
      <textarea
        className={s.formTextarea}
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
      <div className={s.formActions}>
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
