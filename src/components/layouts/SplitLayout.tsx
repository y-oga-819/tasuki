import React, { useCallback, useEffect, useRef, useState, lazy, Suspense } from "react";
import { useUiStore } from "../../store/uiStore";
import { clampSplitRatio, MIN_SPLIT_RATIO } from "../../utils/layout";
import { DiffPane } from "../DiffPane";
import l from "./Layout.module.css";

const MarkdownViewer = lazy(() =>
  import("../MarkdownViewer").then((m) => ({ default: m.MarkdownViewer })),
);
const ReviewPanel = lazy(() =>
  import("../ReviewPanel").then((m) => ({ default: m.ReviewPanel })),
);
const TerminalPanel = lazy(() =>
  import("../Terminal").then((m) => ({ default: m.TerminalPanel })),
);
const InspectorPanel = lazy(() =>
  import("../InspectorPanel").then((m) => ({ default: m.InspectorPanel })),
);

const DEFAULT_SPLIT_RATIO = MIN_SPLIT_RATIO;

export const SplitLayout: React.FC = () => {
  const { rightPaneMode, setRightPaneMode } = useUiStore();

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

  const adjustRatio = useCallback(
    (delta: number) => {
      setSplitRatio((prev) => {
        if (!mainRef.current) return prev;
        const width = mainRef.current.getBoundingClientRect().width;
        return clampSplitRatio(prev + delta, width);
      });
    },
    [],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        adjustRatio(-0.05);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        adjustRatio(0.05);
      }
    },
    [adjustRatio],
  );

  useEffect(() => {
    return () => cancelAnimationFrame(rafIdRef.current);
  }, []);

  return (
    <main className={`main-content ${l.splitLayout}`} ref={mainRef}>
      {/* Left pane — diff */}
      <div
        className={l.splitLeft}
        aria-label="Diff"
        style={{ flexBasis: `${splitRatio * 100}%` }}
      >
        <DiffPane />
      </div>

      {/* Resize handle */}
      <div
        className={l.splitHandle}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize pane"
        aria-valuenow={Math.round(splitRatio * 100)}
        aria-valuemin={20}
        aria-valuemax={80}
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onKeyDown={handleKeyDown}
      />

      {/* Right pane — tabs */}
      <div
        className={l.splitRight}
        aria-label="Side panel"
        style={{ flexBasis: `${(1 - splitRatio) * 100}%` }}
      >
        <div className={l.rightPaneTabs} role="tablist" aria-label="Right pane">
          <button
            role="tab"
            id="tab-docs"
            aria-selected={rightPaneMode === "docs"}
            aria-controls="panel-docs"
            className={rightPaneMode === "docs" ? l.rightPaneTabActive : l.rightPaneTab}
            onClick={() => setRightPaneMode("docs")}
          >
            Docs
          </button>
          <button
            role="tab"
            id="tab-terminal"
            aria-selected={rightPaneMode === "terminal"}
            aria-controls="panel-terminal"
            className={rightPaneMode === "terminal" ? l.rightPaneTabActive : l.rightPaneTab}
            onClick={() => setRightPaneMode("terminal")}
          >
            Terminal
          </button>
          <button
            role="tab"
            id="tab-review"
            aria-selected={rightPaneMode === "review"}
            aria-controls="panel-review"
            className={rightPaneMode === "review" ? l.rightPaneTabActive : l.rightPaneTab}
            onClick={() => setRightPaneMode("review")}
          >
            Review
          </button>
          <button
            role="tab"
            id="tab-inspector"
            aria-selected={rightPaneMode === "inspector"}
            aria-controls="panel-inspector"
            className={rightPaneMode === "inspector" ? l.rightPaneTabActive : l.rightPaneTab}
            onClick={() => setRightPaneMode("inspector")}
          >
            Inspector
          </button>
        </div>
        <div
          className={l.rightPaneBody}
          role="tabpanel"
          id={`panel-${rightPaneMode}`}
          aria-labelledby={`tab-${rightPaneMode}`}
        >
          <Suspense fallback={<MarkdownSkeleton />}>
            {rightPaneMode === "docs" && <MarkdownViewer />}
            {rightPaneMode === "terminal" && <TerminalPanel visible />}
            {rightPaneMode === "review" && <ReviewPanel />}
            {rightPaneMode === "inspector" && <InspectorPanel />}
          </Suspense>
        </div>
      </div>
    </main>
  );
};

/** Skeleton loading for Markdown/Review/Terminal panes */
const MarkdownSkeleton: React.FC = () => (
  <div className="skeleton-container">
    <div className="skeleton-header skeleton-pulse" style={{ width: "40%" }} />
    <div className="skeleton-lines">
      <div className="skeleton-line skeleton-pulse" style={{ width: "95%" }} />
      <div className="skeleton-line skeleton-pulse" style={{ width: "80%" }} />
      <div className="skeleton-line skeleton-pulse" style={{ width: "60%" }} />
    </div>
    <div className="skeleton-header skeleton-pulse" style={{ width: "30%", marginTop: "1rem" }} />
    <div className="skeleton-lines">
      <div className="skeleton-line skeleton-pulse" style={{ width: "85%" }} />
      <div className="skeleton-line skeleton-pulse" style={{ width: "70%" }} />
    </div>
  </div>
);
