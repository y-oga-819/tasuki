import React, { useCallback, useEffect, useRef, useState, lazy, Suspense } from "react";
import { useDisplayStore } from "../../store/displayStore";
import { clampSplitRatio } from "../../utils/layout";
import { DiffPane } from "../DiffPane";

const MarkdownViewer = lazy(() =>
  import("../MarkdownViewer").then((m) => ({ default: m.MarkdownViewer })),
);
const ReviewPanel = lazy(() =>
  import("../ReviewPanel").then((m) => ({ default: m.ReviewPanel })),
);
const TerminalPanel = lazy(() =>
  import("../Terminal").then((m) => ({ default: m.TerminalPanel })),
);

const DEFAULT_SPLIT_RATIO = 0.65;

export const SplitLayout: React.FC = () => {
  const { rightPaneMode, setRightPaneMode } = useDisplayStore();

  const [splitRatio, setSplitRatio] = useState(DEFAULT_SPLIT_RATIO);
  const mainRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const rafIdRef = useRef(0);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    draggingRef.current = true;
    document.body.style.userSelect = "none";
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggingRef.current || !mainRef.current) return;
    const { clientX } = e;
    cancelAnimationFrame(rafIdRef.current);
    rafIdRef.current = requestAnimationFrame(() => {
      if (!mainRef.current) return;
      const rect = mainRef.current.getBoundingClientRect();
      const ratio = (clientX - rect.left) / rect.width;
      setSplitRatio(clampSplitRatio(ratio, rect.width));
    });
  }, []);

  const handlePointerUp = useCallback(() => {
    draggingRef.current = false;
    document.body.style.userSelect = "";
    cancelAnimationFrame(rafIdRef.current);
  }, []);

  // Clamp ratio to respect MAX_RIGHT_WIDTH on mount and window resize
  useEffect(() => {
    const onResize = () => {
      if (!mainRef.current) return;
      const width = mainRef.current.getBoundingClientRect().width;
      setSplitRatio((prev) => clampSplitRatio(prev, width));
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    return () => cancelAnimationFrame(rafIdRef.current);
  }, []);

  return (
    <main className="main-content split-layout" ref={mainRef}>
      {/* Left pane — diff */}
      <div
        className="split-left"
        style={{ flexBasis: `${splitRatio * 100}%` }}
      >
        <DiffPane />
      </div>

      {/* Resize handle */}
      <div
        className="split-handle"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize pane"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />

      {/* Right pane — tabs */}
      <div
        className="split-right"
        style={{ flexBasis: `${(1 - splitRatio) * 100}%` }}
      >
        <div className="right-pane-tabs">
          <button
            className={`right-pane-tab ${rightPaneMode === "docs" ? "active" : ""}`}
            onClick={() => setRightPaneMode("docs")}
          >
            Docs
          </button>
          <button
            className={`right-pane-tab ${rightPaneMode === "terminal" ? "active" : ""}`}
            onClick={() => setRightPaneMode("terminal")}
          >
            Terminal
          </button>
          <button
            className={`right-pane-tab ${rightPaneMode === "review" ? "active" : ""}`}
            onClick={() => setRightPaneMode("review")}
          >
            Review
          </button>
        </div>
        <div className="right-pane-body">
          <Suspense fallback={<div className="loading-spinner">Loading...</div>}>
            {rightPaneMode === "docs" && <MarkdownViewer />}
            {rightPaneMode === "terminal" && <TerminalPanel visible />}
            {rightPaneMode === "review" && <ReviewPanel />}
          </Suspense>
        </div>
      </div>
    </main>
  );
};
