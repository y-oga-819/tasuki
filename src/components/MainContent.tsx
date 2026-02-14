import React, { useEffect, useRef } from "react";
import { useStore } from "../store";
import { DiffViewer } from "./DiffViewer";
import { MarkdownViewer } from "./MarkdownViewer";
import { ResizablePane } from "./ResizablePane";
import { TerminalPanel } from "./Terminal";

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
          <DiffViewer fileDiff={fd} />
        </div>
      ))}
    </div>
  );
};

export const MainContent: React.FC = () => {
  const { displayMode, isLoading, error } = useStore();

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
    <main className="main-content">
      {displayMode === "docs" && (
        <div className="content-panel docs-only">
          <MarkdownViewer />
        </div>
      )}

      {displayMode === "diff" && (
        <div className="content-panel diff-only">
          <AllFileDiffs />
        </div>
      )}

      {displayMode === "diff-docs" && (
        <div className="content-panel split-view">
          <ResizablePane
            left={<AllFileDiffs />}
            right={<MarkdownViewer />}
            defaultRatio={0.5}
            minRatio={0.2}
            maxRatio={0.8}
            maxRightWidth={900}
          />
        </div>
      )}

      <TerminalPanel visible={displayMode === "terminal"} />
    </main>
  );
};
