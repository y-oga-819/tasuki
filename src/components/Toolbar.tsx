import React from "react";
import { useStore } from "../store";
import type { DisplayMode, DiffLayout } from "../types";

export const Toolbar: React.FC = () => {
  const {
    displayMode,
    setDisplayMode,
    diffLayout,
    setDiffLayout,
    diffResult,
    repoPath,
  } = useStore();

  return (
    <header className="toolbar">
      <div className="toolbar-left">
        <h1 className="toolbar-title">Tasuki</h1>
        {repoPath && (
          <span className="toolbar-repo" title={repoPath}>
            {repoPath.split("/").pop()}
          </span>
        )}
      </div>

      <div className="toolbar-center">
        <div className="tab-group" role="tablist">
          <TabButton
            active={displayMode === "docs"}
            onClick={() => setDisplayMode("docs")}
            label="Docs"
          />
          <TabButton
            active={displayMode === "diff"}
            onClick={() => setDisplayMode("diff")}
            label="Diff"
          />
          <TabButton
            active={displayMode === "diff-docs"}
            onClick={() => setDisplayMode("diff-docs")}
            label="Diff + Docs"
          />
        </div>
      </div>

      <div className="toolbar-right">
        {(displayMode === "diff" || displayMode === "diff-docs") && (
          <div className="layout-toggle">
            <button
              className={`layout-btn ${diffLayout === "split" ? "active" : ""}`}
              onClick={() => setDiffLayout("split")}
              title="Split view (side-by-side)"
            >
              Split
            </button>
            <button
              className={`layout-btn ${diffLayout === "stacked" ? "active" : ""}`}
              onClick={() => setDiffLayout("stacked")}
              title="Stacked view (unified)"
            >
              Stacked
            </button>
          </div>
        )}

        {diffResult && (
          <div className="toolbar-stats">
            <span className="stat-files">
              {diffResult.stats.files_changed} files
            </span>
            <span className="stat-added">+{diffResult.stats.additions}</span>
            <span className="stat-deleted">-{diffResult.stats.deletions}</span>
          </div>
        )}
      </div>
    </header>
  );
};

const TabButton: React.FC<{
  active: boolean;
  onClick: () => void;
  label: string;
}> = ({ active, onClick, label }) => (
  <button
    role="tab"
    aria-selected={active}
    className={`tab-btn ${active ? "active" : ""}`}
    onClick={onClick}
  >
    {label}
  </button>
);
