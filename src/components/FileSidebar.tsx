import React, { useCallback, useMemo, useState } from "react";
import { useStore } from "../store";
import type { FileDiff } from "../types";
import {
  getFileName,
  getFileDir,
  getStatusColor,
  getStatusLabel,
} from "../utils/diff-utils";

interface FileTreeNode {
  name: string;
  path: string;
  isDir: boolean;
  children: FileTreeNode[];
  fileDiff?: FileDiff;
}

/** Build a tree from flat file paths, collapsing single-child directories */
function buildFileTree(files: FileDiff[]): FileTreeNode[] {
  const root: FileTreeNode = {
    name: "",
    path: "",
    isDir: true,
    children: [],
  };

  for (const fd of files) {
    const parts = fd.file.path.split("/");
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;

      if (isLast) {
        current.children.push({
          name: part,
          path: fd.file.path,
          isDir: false,
          children: [],
          fileDiff: fd,
        });
      } else {
        let dirNode = current.children.find(
          (c) => c.isDir && c.name === part,
        );
        if (!dirNode) {
          dirNode = {
            name: part,
            path: parts.slice(0, i + 1).join("/"),
            isDir: true,
            children: [],
          };
          current.children.push(dirNode);
        }
        current = dirNode;
      }
    }
  }

  // Collapse single-child directories (e.g., src/components → src/components)
  function collapse(node: FileTreeNode): FileTreeNode {
    if (
      node.isDir &&
      node.children.length === 1 &&
      node.children[0].isDir
    ) {
      const child = node.children[0];
      return collapse({
        ...child,
        name: `${node.name}/${child.name}`,
        path: child.path,
      });
    }
    return {
      ...node,
      children: node.children.map(collapse),
    };
  }

  // Sort: directories first, then alphabetically
  function sortTree(nodes: FileTreeNode[]): FileTreeNode[] {
    return nodes
      .map((n) => ({ ...n, children: sortTree(n.children) }))
      .sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  }

  const collapsed = root.children.map(collapse);
  return sortTree(collapsed);
}

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
    setDocSource,
    designDocs,
    comments,
  } = useStore();

  const [collapsedDirs, setCollapsedDirs] = useState<Set<string>>(new Set());

  const showDiffFiles = displayMode === "diff" || displayMode === "diff-docs";
  const showDocFiles = displayMode === "docs" || displayMode === "diff-docs";

  // Count comments per file
  const commentCount = (path: string) =>
    comments.filter((c) => c.file_path === path).length;

  const fileTree = useMemo(
    () => (diffResult ? buildFileTree(diffResult.files) : []),
    [diffResult],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!diffResult) return;
      const files = diffResult.files;
      const currentIndex = files.findIndex(
        (f) => f.file.path === selectedFile,
      );

      if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = Math.min(currentIndex + 1, files.length - 1);
        setSelectedFile(files[next].file.path);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prev = Math.max(currentIndex - 1, 0);
        setSelectedFile(files[prev].file.path);
      }
    },
    [diffResult, selectedFile, setSelectedFile],
  );

  const toggleDir = useCallback((dirPath: string) => {
    setCollapsedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(dirPath)) {
        next.delete(dirPath);
      } else {
        next.add(dirPath);
      }
      return next;
    });
  }, []);

  const renderTreeNode = (node: FileTreeNode, depth: number) => {
    if (node.isDir) {
      const isCollapsed = collapsedDirs.has(node.path);
      return (
        <React.Fragment key={node.path}>
          <li
            className="file-item tree-dir"
            style={{ paddingLeft: `${depth * 12 + 12}px` }}
            onClick={() => toggleDir(node.path)}
          >
            <span className="tree-toggle">
              {isCollapsed ? "▶" : "▼"}
            </span>
            <span className="file-name">{node.name}</span>
          </li>
          {!isCollapsed &&
            node.children.map((child) =>
              renderTreeNode(child, depth + 1),
            )}
        </React.Fragment>
      );
    }

    const fd = node.fileDiff!;
    const isGenCollapsed = collapsedFiles.has(fd.file.path);
    const isGenerated = fd.file.is_generated;
    const count = commentCount(fd.file.path);

    return (
      <li
        key={fd.file.path}
        className={`file-item ${selectedFile === fd.file.path ? "selected" : ""} ${isGenerated ? "generated" : ""}`}
        style={{ paddingLeft: `${depth * 12 + 12}px` }}
        onClick={() => {
          if (isGenerated && isGenCollapsed) {
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
        <span className="file-name">{node.name}</span>
        <span className="file-changes">
          {fd.file.additions > 0 && (
            <span className="stat-added">+{fd.file.additions}</span>
          )}
          {fd.file.deletions > 0 && (
            <span className="stat-deleted">-{fd.file.deletions}</span>
          )}
        </span>
        {count > 0 && <span className="comment-badge">{count}</span>}
        {isGenerated && (
          <button
            className="collapse-btn"
            onClick={(e) => {
              e.stopPropagation();
              toggleFileCollapse(fd.file.path);
            }}
            title={isGenCollapsed ? "Expand" : "Collapse"}
          >
            {isGenCollapsed ? "▶" : "▼"}
          </button>
        )}
      </li>
    );
  };

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
                onClick={() => {
                  setDocSource("repo");
                  setSelectedDoc(path);
                }}
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

      {showDocFiles && designDocs.length > 0 && (
        <div className="sidebar-section">
          <h3 className="sidebar-section-title">Design Docs</h3>
          <ul className="file-list">
            {designDocs.map((filename) => {
              const docId = `design:${filename}`;
              return (
                <li
                  key={docId}
                  className={`file-item ${selectedDoc === docId ? "selected" : ""}`}
                  onClick={() => {
                    setDocSource("design");
                    setSelectedDoc(docId);
                  }}
                  title={filename}
                >
                  <span className="file-icon">📐</span>
                  <span className="file-name">{filename}</span>
                </li>
              );
            })}
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
          <ul className="file-list" tabIndex={0} onKeyDown={handleKeyDown}>
            {fileTree.map((node) => renderTreeNode(node, 0))}
          </ul>
        </div>
      )}
    </aside>
  );
};
