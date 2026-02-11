import React from "react";
import { useStore } from "../store";
import { DiffView } from "./DiffView";
import { MarkdownViewer } from "./MarkdownViewer";

export const MainContent: React.FC = () => {
  const { displayMode, diffResult, selectedFile, isLoading, error } =
    useStore();

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

  const selectedFileDiff = diffResult?.files.find(
    (f) => f.file.path === selectedFile,
  );

  return (
    <main className="main-content">
      {displayMode === "docs" && (
        <div className="content-panel docs-only">
          <MarkdownViewer />
        </div>
      )}

      {displayMode === "diff" && (
        <div className="content-panel diff-only">
          {selectedFileDiff ? (
            <DiffView fileDiff={selectedFileDiff} />
          ) : diffResult && diffResult.files.length > 0 ? (
            <div className="no-selection">
              <p>Select a file from the sidebar to view changes.</p>
            </div>
          ) : (
            <div className="no-changes">
              <p>No changes detected.</p>
              <p className="hint">
                Make changes to the repository and they will appear here.
              </p>
            </div>
          )}
        </div>
      )}

      {displayMode === "diff-docs" && (
        <div className="content-panel split-view">
          <div className="split-left">
            {selectedFileDiff ? (
              <DiffView fileDiff={selectedFileDiff} />
            ) : (
              <div className="no-selection">
                <p>Select a file from the sidebar to view changes.</p>
              </div>
            )}
          </div>
          <div className="split-divider" />
          <div className="split-right">
            <MarkdownViewer />
          </div>
        </div>
      )}
    </main>
  );
};
