import React from "react";
import { useStore } from "../store";
import {
  getFileName,
  getFileDir,
  getStatusColor,
  getStatusLabel,
} from "../utils/diff-utils";

export const FileSidebar: React.FC = () => {
  const {
    diffResult,
    selectedFile,
    setSelectedFile,
    collapsedFiles,
    toggleFileCollapse,
    displayMode,
    docFiles,
    selectedDoc,
    setSelectedDoc,
    comments,
  } = useStore();

  const showDiffFiles = displayMode === "diff" || displayMode === "diff-docs";
  const showDocFiles = displayMode === "docs" || displayMode === "diff-docs";

  // Count comments per file
  const commentCount = (path: string) =>
    comments.filter((c) => c.file_path === path).length;

  return (
    <aside className="file-sidebar">
      {showDocFiles && docFiles.length > 0 && (
        <div className="sidebar-section">
          <h3 className="sidebar-section-title">Documents</h3>
          <ul className="file-list">
            {docFiles.map((path) => (
              <li
                key={path}
                className={`file-item ${selectedDoc === path ? "selected" : ""}`}
                onClick={() => setSelectedDoc(path)}
                title={path}
              >
                <span className="file-icon">📄</span>
                <span className="file-name">{getFileName(path)}</span>
                <span className="file-dir">{getFileDir(path)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {showDiffFiles && diffResult && (
        <div className="sidebar-section">
          <h3 className="sidebar-section-title">
            Changed Files
            <span className="badge">{diffResult.stats.files_changed}</span>
          </h3>
          <div className="sidebar-stats">
            <span className="stat-added">+{diffResult.stats.additions}</span>
            <span className="stat-deleted">-{diffResult.stats.deletions}</span>
          </div>
          <ul className="file-list">
            {diffResult.files.map((fd) => {
              const isCollapsed = collapsedFiles.has(fd.file.path);
              const isGenerated = fd.file.is_generated;
              const count = commentCount(fd.file.path);

              return (
                <li
                  key={fd.file.path}
                  className={`file-item ${selectedFile === fd.file.path ? "selected" : ""} ${isGenerated ? "generated" : ""}`}
                  onClick={() => {
                    if (isGenerated && isCollapsed) {
                      toggleFileCollapse(fd.file.path);
                    }
                    setSelectedFile(fd.file.path);
                  }}
                  title={fd.file.path}
                >
                  <span
                    className="file-status"
                    style={{ color: getStatusColor(fd.file.status) }}
                  >
                    {getStatusLabel(fd.file.status)}
                  </span>
                  <span className="file-name">{getFileName(fd.file.path)}</span>
                  <span className="file-dir">{getFileDir(fd.file.path)}</span>
                  <span className="file-changes">
                    {fd.file.additions > 0 && (
                      <span className="stat-added">+{fd.file.additions}</span>
                    )}
                    {fd.file.deletions > 0 && (
                      <span className="stat-deleted">-{fd.file.deletions}</span>
                    )}
                  </span>
                  {count > 0 && (
                    <span className="comment-badge">{count}</span>
                  )}
                  {isGenerated && (
                    <button
                      className="collapse-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFileCollapse(fd.file.path);
                      }}
                      title={isCollapsed ? "Expand" : "Collapse"}
                    >
                      {isCollapsed ? "▶" : "▼"}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </aside>
  );
};
