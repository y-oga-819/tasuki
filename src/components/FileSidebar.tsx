import React, { useCallback, useMemo, useState } from "react";
import { useStore } from "../store";
import type { FileDiff } from "../types";
import { getStatusColor, getStatusLabel } from "../utils/diff-utils";
import {
  getFileIcon,
  FolderOpenIcon,
  FolderClosedIcon,
} from "../utils/file-icons";

interface FileTreeNode {
  name: string;
  path: string;
  isDir: boolean;
  children: FileTreeNode[];
  fileDiff?: FileDiff;
}

/** Collapse single-child directories (e.g., src/components → src/components) */
function collapseNode(node: FileTreeNode): FileTreeNode {
  if (
    node.isDir &&
    node.children.length === 1 &&
    node.children[0].isDir
  ) {
    const child = node.children[0];
    return collapseNode({
      ...child,
      name: `${node.name}/${child.name}`,
      path: child.path,
    });
  }
  return {
    ...node,
    children: node.children.map(collapseNode),
  };
}

/** Sort: directories first, then alphabetically */
function sortTreeNodes(nodes: FileTreeNode[]): FileTreeNode[] {
  return nodes
    .map((n) => ({ ...n, children: sortTreeNodes(n.children) }))
    .sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
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

  return sortTreeNodes(root.children.map(collapseNode));
}

/** Build a tree from plain path strings (no FileDiff) */
function buildPathTree(paths: string[]): FileTreeNode[] {
  const root: FileTreeNode = {
    name: "",
    path: "",
    isDir: true,
    children: [],
  };

  for (const p of paths) {
    const parts = p.split("/");
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;

      if (isLast) {
        current.children.push({
          name: part,
          path: p,
          isDir: false,
          children: [],
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

  return sortTreeNodes(root.children.map(collapseNode));
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
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    new Set(),
  );

  const toggleSection = useCallback((sectionId: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }, []);

  const showDiffFiles = displayMode === "diff" || displayMode === "diff-docs";
  const showDocFiles = displayMode === "docs" || displayMode === "diff-docs";

  // Count comments per file
  const commentCount = (path: string) =>
    comments.filter((c) => c.file_path === path).length;

  const fileTree = useMemo(
    () => (diffResult ? buildFileTree(diffResult.files) : []),
    [diffResult],
  );

  const docTree = useMemo(() => buildPathTree(docFiles), [docFiles]);

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
            <span className="file-icon">
              {isCollapsed ? <FolderClosedIcon /> : <FolderOpenIcon />}
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
        <span className="file-icon">{getFileIcon(node.name)}</span>
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

  const renderDocTreeNode = (node: FileTreeNode, depth: number) => {
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
            <span className="file-icon">
              {isCollapsed ? <FolderClosedIcon /> : <FolderOpenIcon />}
            </span>
            <span className="file-name">{node.name}</span>
          </li>
          {!isCollapsed &&
            node.children.map((child) =>
              renderDocTreeNode(child, depth + 1),
            )}
        </React.Fragment>
      );
    }

    return (
      <li
        key={node.path}
        className={`file-item ${selectedDoc === node.path ? "selected" : ""}`}
        style={{ paddingLeft: `${depth * 12 + 12}px` }}
        onClick={() => {
          setDocSource("repo");
          setSelectedDoc(node.path);
        }}
        title={node.path}
      >
        <span className="file-icon">{getFileIcon(node.name)}</span>
        <span className="file-name">{node.name}</span>
      </li>
    );
  };

  return (
    <aside className="file-sidebar">
      {showDocFiles && docFiles.length > 0 && (
        <div
          className={`sidebar-section ${collapsedSections.has("documents") ? "collapsed" : ""}`}
        >
          <h3
            className="sidebar-section-title sidebar-section-toggle"
            onClick={() => toggleSection("documents")}
          >
            <span className="section-chevron">▼</span>
            Documents
          </h3>
          <div
            className={`section-collapse ${collapsedSections.has("documents") ? "collapsed" : ""}`}
          >
            <div className="section-collapse-inner">
              <ul className="file-list">
                {docTree.map((node) => renderDocTreeNode(node, 0))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {showDocFiles && designDocs.length > 0 && (
        <div
          className={`sidebar-section ${collapsedSections.has("design-docs") ? "collapsed" : ""}`}
        >
          <h3
            className="sidebar-section-title sidebar-section-toggle"
            onClick={() => toggleSection("design-docs")}
          >
            <span className="section-chevron">▼</span>
            Design Docs
          </h3>
          <div
            className={`section-collapse ${collapsedSections.has("design-docs") ? "collapsed" : ""}`}
          >
            <div className="section-collapse-inner">
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
          </div>
        </div>
      )}

      {showDiffFiles && diffResult && (
        <div
          className={`sidebar-section ${collapsedSections.has("changed-files") ? "collapsed" : ""}`}
        >
          <h3
            className="sidebar-section-title sidebar-section-toggle"
            onClick={() => toggleSection("changed-files")}
          >
            <span className="section-chevron">▼</span>
            Changed Files
            <span className="badge">{diffResult.stats.files_changed}</span>
          </h3>
          <div
            className={`section-collapse ${collapsedSections.has("changed-files") ? "collapsed" : ""}`}
          >
            <div className="section-collapse-inner">
              <div className="sidebar-stats">
                <span className="stat-added">
                  +{diffResult.stats.additions}
                </span>
                <span className="stat-deleted">
                  -{diffResult.stats.deletions}
                </span>
              </div>
              <ul className="file-list" tabIndex={0} onKeyDown={handleKeyDown}>
                {fileTree.map((node) => renderTreeNode(node, 0))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
