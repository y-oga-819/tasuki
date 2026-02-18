import React, { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "../store";
import { DiffViewer } from "./DiffViewer";
import { DiffSearchBar } from "./DiffSearchBar";
import { ErrorBoundary } from "./ErrorBoundary";
import { MarkdownViewer } from "./MarkdownViewer";
import { ResizablePane } from "./ResizablePane";
import { TerminalPanel } from "./Terminal";

const isMac =
  typeof navigator !== "undefined" && navigator.platform.includes("Mac");

/** Render all file diffs, scrolling to selectedFile on change */
const AllFileDiffs: React.FC = () => {
  const { diffResult, selectedFile, collapsedFiles, toggleFileCollapse } =
    useStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const prevFileRef = useRef<string | null>(null);

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

const MIN_TERMINAL_RATIO = 0.3;
const MAX_TERMINAL_RATIO = 0.8;
const MAX_DOCS_WIDTH = 900;
// Start small so the mount-time clamp opens docs at MAX_DOCS_WIDTH
const DEFAULT_TERMINAL_RATIO = MIN_TERMINAL_RATIO;

export const MainContent: React.FC = () => {
  const { displayMode, isLoading, error } = useStore();

  // Terminal-docs split resize
  const [terminalRatio, setTerminalRatio] = useState(DEFAULT_TERMINAL_RATIO);
  const mainRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const rafIdRef = useRef(0);

  const clampRatio = useCallback((ratio: number, containerWidth: number) => {
    const effectiveMin = Math.max(
      MIN_TERMINAL_RATIO,
      1 - MAX_DOCS_WIDTH / containerWidth,
    );
    return Math.max(effectiveMin, Math.min(MAX_TERMINAL_RATIO, ratio));
  }, []);

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
      setTerminalRatio(clampRatio(ratio, rect.width));
    });
  }, [clampRatio]);

  const handleSplitPointerUp = useCallback(() => {
    draggingRef.current = false;
    document.body.style.userSelect = "";
    cancelAnimationFrame(rafIdRef.current);
  }, []);

  // Clamp ratio to respect MAX_DOCS_WIDTH on mount and window resize
  useEffect(() => {
    const clamp = () => {
      if (!mainRef.current) return;
      const width = mainRef.current.getBoundingClientRect().width;
      setTerminalRatio((prev) => clampRatio(prev, width));
    };
    clamp();
    window.addEventListener("resize", clamp);
    return () => window.removeEventListener("resize", clamp);
  }, [clampRatio]);

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

  const isTerminal = displayMode === "terminal";

  return (
    <main
      className={`main-content ${isTerminal ? "terminal-layout" : ""}`}
      ref={mainRef}
    >
      {displayMode === "docs" && (
        <div className="content-panel docs-only">
          <MarkdownViewer />
        </div>
      )}

      {displayMode === "diff" && (
        <div className="content-panel diff-only">
          <DiffContentWithSearch />
        </div>
      )}

      {displayMode === "diff-docs" && (
        <div className="content-panel split-view">
          <ResizablePane
            left={<DiffContentWithSearch />}
            right={<MarkdownViewer />}
            defaultRatio={0.2}
            minRatio={0.2}
            maxRatio={0.8}
            maxRightWidth={900}
          />
        </div>
      )}

      {/* Terminal always rendered to preserve xterm state; wrapper controls layout */}
      <div
        className="terminal-split-main"
        style={
          isTerminal
            ? { flexBasis: `${terminalRatio * 100}%` }
            : { display: "none" }
        }
      >
        <TerminalPanel visible={isTerminal} />
      </div>

      {isTerminal && (
        <>
          <div
            className="terminal-split-handle"
            onPointerDown={handleSplitPointerDown}
            onPointerMove={handleSplitPointerMove}
            onPointerUp={handleSplitPointerUp}
          />
          <div
            className="terminal-split-docs"
            style={{ flexBasis: `${(1 - terminalRatio) * 100}%` }}
          >
            <MarkdownViewer />
          </div>
        </>
      )}
    </main>
  );
};
