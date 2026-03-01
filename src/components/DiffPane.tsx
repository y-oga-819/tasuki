import React, { useCallback, useEffect, useRef, useState } from "react";
import { useDiffStore } from "../store/diffStore";
import { useEditorStore } from "../store/editorStore";
import { DiffViewer } from "./DiffViewer";
import { DiffSearchBar } from "./DiffSearchBar";
import { ErrorBoundary } from "./ErrorBoundary";
import type { FileDiff } from "../types";

const isMac =
  typeof navigator !== "undefined" && navigator.platform.includes("Mac");

/** Placeholder height for a file diff before it's rendered */
const PLACEHOLDER_HEIGHT = 64;

/**
 * Lazy-rendered diff: mounts DiffViewer only when entering viewport.
 * Uses IntersectionObserver with a generous rootMargin for pre-loading.
 * Once mounted, stays mounted to preserve scroll position and state.
 */
const LazyDiffViewer: React.FC<{
  fileDiff: FileDiff;
  forceMount: boolean;
}> = ({ fileDiff, forceMount }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(forceMount);

  useEffect(() => {
    if (mounted || forceMount) {
      setMounted(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setMounted(true);
          observer.disconnect();
        }
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [mounted, forceMount]);

  if (!mounted) {
    return (
      <div
        ref={ref}
        className="diff-placeholder"
        style={{ height: PLACEHOLDER_HEIGHT }}
        data-file-path={fileDiff.file.path}
      />
    );
  }

  return (
    <ErrorBoundary>
      <DiffViewer fileDiff={fileDiff} />
    </ErrorBoundary>
  );
};

/** Number of file diffs to mount eagerly (first visible files) */
const EAGER_MOUNT_COUNT = 5;

/** Render all file diffs, scrolling to selectedFile on change */
const AllFileDiffs: React.FC = () => {
  const { diffResult, selectedFile, collapsedFiles, toggleFileCollapse } =
    useDiffStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const prevFileRef = useRef<string | null>(null);

  // Track which files have been selected (force-mount them)
  const forceMountedRef = useRef<Set<string>>(new Set());
  const forceMount = useCallback((path: string) => {
    forceMountedRef.current.add(path);
  }, []);

  // selectedFile変更時のみ実行。collapsedFiles/toggleFileCollapseは
  // 意図的に依存配列から除外（折りたたみ操作でのスクロール発火を防止）
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!selectedFile || selectedFile === prevFileRef.current) return;
    prevFileRef.current = selectedFile;

    // Force-mount the selected file so it renders before scroll
    forceMount(selectedFile);

    if (collapsedFiles.has(selectedFile)) {
      toggleFileCollapse(selectedFile);
    }

    // Delay scroll to allow the diff to render
    requestAnimationFrame(() => {
      const el = containerRef.current?.querySelector(
        `[data-file-path="${CSS.escape(selectedFile)}"]`,
      );
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [selectedFile]);
  /* eslint-enable react-hooks/exhaustive-deps */

  if (!diffResult || diffResult.files.length === 0) {
    return (
      <div className="no-changes">
        <p>No changes detected.</p>
        <p className="hint">
          Make changes to the repository and they will appear here.
        </p>
      </div>
    );
  }

  return (
    <div ref={containerRef}>
      {diffResult.files.map((fd, i) => (
        <div key={fd.file.path} data-file-path={fd.file.path}>
          <LazyDiffViewer
            fileDiff={fd}
            forceMount={
              i < EAGER_MOUNT_COUNT ||
              forceMountedRef.current.has(fd.file.path)
            }
          />
        </div>
      ))}
    </div>
  );
};

/** Diff content wrapped with a find-in-diff search bar (Cmd+F) */
export const DiffPane: React.FC = () => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [searchVisible, setSearchVisible] = useState(false);
  const { diffResult, selectedFile, setSelectedFile } = useDiffStore();
  const { lineSelection, setCommentFormTarget, commentFormTarget } = useEditorStore();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((isMac ? e.metaKey : e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        setSearchVisible(true);
        return;
      }

      // Skip if user is typing in an input/textarea
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const files = diffResult?.files;
      if (!files || files.length === 0) return;

      switch (e.key) {
        case "j":
        case "k": {
          e.preventDefault();
          const idx = files.findIndex((f) => f.file.path === selectedFile);
          const next = e.key === "j"
            ? Math.min(idx + 1, files.length - 1)
            : Math.max(idx - 1, 0);
          setSelectedFile(files[next].file.path);
          break;
        }
        case "n":
        case "N": {
          e.preventDefault();
          // Jump between file headers in the scroll container
          const headers = scrollRef.current?.querySelectorAll(".dv-file-header");
          if (!headers || headers.length === 0) break;
          const container = scrollRef.current!;
          const scrollTop = container.scrollTop;
          const offset = 10; // small buffer to avoid sticking to current

          if (e.key === "n") {
            // Next header below current scroll position
            for (const h of headers) {
              const top = (h as HTMLElement).offsetTop;
              if (top > scrollTop + offset) {
                container.scrollTo({ top, behavior: "smooth" });
                break;
              }
            }
          } else {
            // Previous header above current scroll position
            for (let i = headers.length - 1; i >= 0; i--) {
              const top = (headers[i] as HTMLElement).offsetTop;
              if (top < scrollTop - offset) {
                container.scrollTo({ top, behavior: "smooth" });
                break;
              }
            }
          }
          break;
        }
        case "c": {
          // Open comment form at current line selection
          if (commentFormTarget) break; // already open
          if (lineSelection) {
            e.preventDefault();
            setCommentFormTarget({
              filePath: lineSelection.file,
              lineNumber: lineSelection.range.end,
              side: lineSelection.range.side ?? "additions",
              selectionStart: lineSelection.range.start,
              selectionEnd: lineSelection.range.end,
            });
          }
          break;
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [diffResult, selectedFile, setSelectedFile, lineSelection, commentFormTarget, setCommentFormTarget]);

  return (
    <div className="diff-content-search-wrapper">
      {searchVisible && (
        <DiffSearchBar
          scrollContainerRef={scrollRef}
          onClose={() => setSearchVisible(false)}
        />
      )}
      <div className="diff-scroll-container" ref={scrollRef}>
        <AllFileDiffs />
      </div>
    </div>
  );
};
