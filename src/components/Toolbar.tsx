import React, { useCallback, useEffect } from "react";
import { useUiStore } from "../store/uiStore";
import { useDiffStore } from "../store/diffStore";
import * as api from "../utils/tauri-api";
import s from "./Toolbar.module.css";


export const Toolbar: React.FC = () => {
  const {
    displayMode,
    setDisplayMode,
    diffLayout,
    setDiffLayout,
    diffOverflow,
    setDiffOverflow,
    expandUnchanged,
    setExpandUnchanged,
  } = useUiStore();
  const { diffResult, repoInfo } = useDiffStore();

  const isTauri = typeof window !== "undefined" && "__TAURI__" in window;

  const handleOpenInZed = useCallback(() => {
    api.openInZed().catch((e) => console.error("Failed to open Zed:", e));
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        handleOpenInZed();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleOpenInZed]);

  return (
    <header className={s.toolbar}>
      <div className={s.left}>
        <h1 className={s.title}>Tasuki</h1>
        {repoInfo && (
          <>
            <span className={s.repo}>{repoInfo.repo_name}</span>
            {repoInfo.branch_name && (
              <span className={s.branch}>
                <svg className={s.branchIcon} width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M11.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zm-2.25.75a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.493 2.493 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25zM4.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zM3.5 3.25a.75.75 0 1 1 1.5 0 .75.75 0 0 1-1.5 0z" />
                </svg>
                {repoInfo.branch_name}
              </span>
            )}
            {repoInfo.is_worktree && (
              <span className={s.worktreeBadge}>worktree</span>
            )}
          </>
        )}
      </div>

      <div className={s.center}>
        <div className="tab-group" role="tablist">
          <TabButton
            active={displayMode === "diff"}
            onClick={() => setDisplayMode("diff")}
            label="Diff"
          />
          <TabButton
            active={displayMode === "split"}
            onClick={() => setDisplayMode("split")}
            label="Split"
          />
          <TabButton
            active={displayMode === "viewer"}
            onClick={() => setDisplayMode("viewer")}
            label="Viewer"
          />
        </div>
      </div>

      <div className={s.right}>
        {displayMode !== "viewer" && (
          <>
            {diffResult && (
              <div className={s.stats} aria-label="Diff statistics">
                <span>
                  {diffResult.stats.files_changed} files
                </span>
                <span className="stat-added">+{diffResult.stats.additions}</span>
                <span className="stat-deleted">-{diffResult.stats.deletions}</span>
              </div>
            )}

            <span className={s.separator} />
            <div className="layout-toggle">
              <button
                className={`layout-btn ${diffLayout === "split" ? "active" : ""}`}
                onClick={() => setDiffLayout("split")}
                title="Split view (side-by-side)"
              >
                Split
              </button>
              <button
                className={`layout-btn ${diffLayout === "unified" ? "active" : ""}`}
                onClick={() => setDiffLayout("unified")}
                title="Unified view (stacked)"
              >
                Unified
              </button>
            </div>
            <div className="layout-toggle">
              <button
                className={`layout-btn ${diffOverflow === "scroll" ? "active" : ""}`}
                onClick={() => setDiffOverflow("scroll")}
                title="Scroll long lines"
              >
                Scroll
              </button>
              <button
                className={`layout-btn ${diffOverflow === "wrap" ? "active" : ""}`}
                onClick={() => setDiffOverflow("wrap")}
                title="Wrap long lines"
              >
                Wrap
              </button>
            </div>
            <button
              className={`layout-btn ${!expandUnchanged ? "active" : ""}`}
              onClick={() => setExpandUnchanged(!expandUnchanged)}
              title={expandUnchanged ? "Collapse unchanged lines" : "Expand all lines"}
            >
              {expandUnchanged ? "Collapse" : "Expand"}
            </button>
          </>
        )}

        {isTauri && (
          <>
            <span className={s.separator} />
            <button
              className="layout-btn"
              onClick={handleOpenInZed}
              title="Open in Zed (⌘+Shift+Z)"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4.5 2l7 5.5-7 5.5V2z" />
              </svg>
              Zed
            </button>
          </>
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
