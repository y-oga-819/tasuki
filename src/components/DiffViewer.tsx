import React from "react";
import { useStore } from "../store";
import type { FileDiff } from "../types";
import { PierreDiffViewer } from "./PierreDiffViewer";

interface DiffViewerProps {
  fileDiff: FileDiff;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({ fileDiff }) => {
  const { collapsedFiles } = useStore();
  const isCollapsed = collapsedFiles.has(fileDiff.file.path);

  return (
    <div className="diff-viewer">
      <DiffFileHeader fileDiff={fileDiff} />
      {!isCollapsed &&
        (fileDiff.file.is_binary ? (
          <div className="diff-binary">Binary file changed</div>
        ) : (
          <PierreDiffViewer fileDiff={fileDiff} />
        ))}
    </div>
  );
};

const DiffFileHeader: React.FC<{ fileDiff: FileDiff }> = ({ fileDiff }) => {
  const { collapsedFiles, toggleFileCollapse } = useStore();
  const isCollapsed = collapsedFiles.has(fileDiff.file.path);

  return (
    <div className="diff-file-header">
      <button
        className="collapse-toggle"
        onClick={() => toggleFileCollapse(fileDiff.file.path)}
      >
        {isCollapsed ? "\u25B6" : "\u25BC"}
      </button>
      <span className="diff-file-path">{fileDiff.file.path}</span>
      {fileDiff.file.old_path && (
        <span className="diff-file-renamed">
          \u2190 {fileDiff.file.old_path}
        </span>
      )}
      <span className="diff-file-stats">
        {fileDiff.file.additions > 0 && (
          <span className="stat-added">+{fileDiff.file.additions}</span>
        )}
        {fileDiff.file.deletions > 0 && (
          <span className="stat-deleted">-{fileDiff.file.deletions}</span>
        )}
      </span>
      {fileDiff.file.is_generated && (
        <span className="generated-badge">Generated</span>
      )}
    </div>
  );
};
