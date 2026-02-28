import React, { useEffect, useRef, useState, useCallback } from "react";
import { useDisplayStore } from "../store/displayStore";
import { useDiffStore } from "../store/diffStore";
import { clampSplitRatio, MAX_RIGHT_WIDTH } from "../utils/layout";
import { DiffViewer } from "./DiffViewer";
import { DiffSearchBar } from "./DiffSearchBar";
import { ErrorBoundary } from "./ErrorBoundary";
import { MarkdownViewer } from "./MarkdownViewer";
import { ReviewPanel } from "./ReviewPanel";
import { ResizablePane } from "./ResizablePane";
import { TerminalPanel } from "./Terminal";

const isMac =
  typeof navigator !== "undefined" && navigator.platform.includes("Mac");

/** Render all file diffs, scrolling to selectedFile on change */
const AllFileDiffs: React.FC = () => {
  const { diffResult, selectedFile, collapsedFiles, toggleFileCollapse } =
    useDiffStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const prevFileRef = useRef<string | null>(null);

  // selectedFile変更時のみ実行。collapsedFiles/toggleFileCollapseは
  // 意図的に依存配列から除外（折りたたみ操作でのスクロール発火を防止）
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!selectedFile || selectedFile === prevFileRef.current) return;
    prevFileRef.current = selectedFile;

    if (collapsedFiles.has(selectedFile)) {
      toggleFileCollapse(selectedFile);
    }

    const el = containerRef.current?.querySelector(
      `[data-file-path="${CSS.escape(selectedFile)}"]`,
    );
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
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
      {diffResult.files.map((fd) => (
        <div key={fd.file.path} data-file-path={fd.file.path}>
          <ErrorBoundary>
            <DiffViewer fileDiff={fd} />
          </ErrorBoundary>
        </div>
      ))}
    </div>
  );
};

/** Diff content wrapped with a find-in-diff search bar */
const DiffContentWithSearch: React.FC = () => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [searchVisible, setSearchVisible] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((isMac ? e.metaKey : e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        setSearchVisible(true);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

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

const DEFAULT_SPLIT_RATIO = 0.65;

export const MainContent: React.FC = () => {
  const { displayMode, rightPaneMode, setRightPaneMode } = useDisplayStore();
  const { isLoading, error } = useDiffStore();

  // Left-right split resize
  const [splitRatio, setSplitRatio] = useState(DEFAULT_SPLIT_RATIO);
  const mainRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const rafIdRef = useRef(0);

  // Terminal singleton refs
  const terminalRef = useRef<HTMLDivElement>(null);
  const viewerTermSlotRef = useRef<HTMLDivElement>(null);
  const splitTermSlotRef = useRef<HTMLDivElement>(null);
  const parkingRef = useRef<HTMLDivElement>(null);

  const handleSplitPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    draggingRef.current = true;
    document.body.style.userSelect = "none";
  }, []);

  const handleSplitPointerMove = useCallback((e: React.PointerEvent) => {
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

  const handleSplitPointerUp = useCallback(() => {
    draggingRef.current = false;
    document.body.style.userSelect = "";
    cancelAnimationFrame(rafIdRef.current);
  }, []);

  const isSplit = displayMode === "split";
  const isViewer = displayMode === "viewer";
  const terminalVisible = isViewer || (isSplit && rightPaneMode === "terminal");

  // DOM reparenting: move terminal container to the appropriate slot
  useEffect(() => {
    const el = terminalRef.current;
    if (!el) return;

    let target: HTMLElement | null;
    if (isViewer) {
      target = viewerTermSlotRef.current;
    } else if (isSplit && rightPaneMode === "terminal") {
      target = splitTermSlotRef.current;
    } else {
      target = parkingRef.current;
    }

    if (target && el.parentElement !== target) {
      target.appendChild(el);
    }
  }, [isViewer, isSplit, rightPaneMode]);

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

  if (isLoading) {
    return (
      <main className="main-content loading">
        <div className="loading-spinner">Loading...</div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="main-content error">
        <div className="error-message">
          <h3>Error</h3>
          <p>{error}</p>
        </div>
      </main>
    );
  }

  return (
    <>
      {isViewer ? (
        <main className="main-content viewer-layout" ref={mainRef}>
          <ResizablePane
            defaultRatio={0.6}
            minRatio={0.3}
            maxRatio={0.85}
            maxRightWidth={MAX_RIGHT_WIDTH}
            left={<MarkdownViewer />}
            right={<div ref={viewerTermSlotRef} className="terminal-slot" />}
          />
        </main>
      ) : (
        <main
          className={`main-content ${isSplit ? "split-layout" : ""}`}
          ref={mainRef}
        >
          {/* Left pane — always diff */}
          <div
            className={`split-left ${!isSplit ? "diff-only" : ""}`}
            style={isSplit ? { flexBasis: `${splitRatio * 100}%` } : undefined}
          >
            <DiffContentWithSearch />
          </div>

          {/* Resize handle */}
          {isSplit && (
            <div
              className="split-handle"
              onPointerDown={handleSplitPointerDown}
              onPointerMove={handleSplitPointerMove}
              onPointerUp={handleSplitPointerUp}
            />
          )}

          {/* Right pane — always rendered to preserve terminal state */}
          <div
            className="split-right"
            style={isSplit ? { flexBasis: `${(1 - splitRatio) * 100}%` } : { display: "none" }}
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
              <div
                className="right-pane-content"
                style={rightPaneMode === "docs" ? undefined : { display: "none" }}
              >
                <MarkdownViewer />
              </div>
              <div
                className="right-pane-content"
                style={rightPaneMode === "terminal" ? undefined : { display: "none" }}
                ref={splitTermSlotRef}
              >
                {/* Terminal moved here via DOM reparenting */}
              </div>
              <div
                className="right-pane-content"
                style={rightPaneMode === "review" ? undefined : { display: "none" }}
              >
                <ReviewPanel />
              </div>
            </div>
          </div>
        </main>
      )}

      {/* Terminal singleton — always mounted, moved between slots via DOM reparenting */}
      <div ref={parkingRef} style={{ display: "none" }}>
        <TerminalPanel ref={terminalRef} visible={terminalVisible} />
      </div>
    </>
  );
};
