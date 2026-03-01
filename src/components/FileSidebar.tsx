import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { List, type RowComponentProps } from "react-window";
import { useUiStore } from "../store/uiStore";
import { useDiffStore } from "../store/diffStore";
import { useDocStore } from "../store/docStore";
import { useReviewStore } from "../store/reviewStore";
import { getStatusColor, getStatusLabel } from "../utils/diff-utils";
import {
  getFileIcon,
  FolderOpenIcon,
  FolderClosedIcon,
} from "../utils/file-icons";
import {
  buildFileTree,
  buildPathTree,
  flattenTree,
  type FileTreeNode,
} from "../utils/file-tree";
import * as api from "../utils/tauri-api";
import s from "./FileSidebar.module.css";

const DIR_ROW_HEIGHT = 28;
const FILE_ROW_HEIGHT = 32;

interface FileSidebarProps {
  style?: React.CSSProperties;
}

export const FileSidebar: React.FC<FileSidebarProps> = ({ style }) => {
  const { displayMode } = useUiStore();
  const {
    diffResult,
    selectedFile,
    setSelectedFile,
    collapsedFiles,
    toggleFileCollapse,
  } = useDiffStore();
  const {
    docFiles,
    selectedDoc,
    setSelectedDoc,
    setDocSource,
    designDocs,
    externalFolders,
    addExternalFolder,
    removeExternalFolder,
    externalDocs,
    setExternalDocs,
  } = useDocStore();
  const { threads } = useReviewStore();

  const isTauri = typeof window !== "undefined" && "__TAURI__" in window;

  const [collapsedDirs, setCollapsedDirs] = useState<Set<string>>(new Set());
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    new Set(),
  );
  const [fileFilter, setFileFilter] = useState("");
  const [focusedNodePath, setFocusedNodePath] = useState<string | null>(null);
  const filterInputRef = useRef<HTMLInputElement>(null);

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

  const isViewer = displayMode === "viewer";
  const showDiffFiles = !isViewer;
  const showDocFiles = displayMode === "split" || isViewer;

  const handleAddFolder = useCallback(async () => {
    try {
      const folder = await api.pickFolder();
      if (!folder) return;
      addExternalFolder(folder);
      const files = await api.listDirDocs(folder);
      setExternalDocs(folder, files);
    } catch (err) {
      console.error("Failed to add folder:", err);
    }
  }, [addExternalFolder, setExternalDocs]);

  // Count threads per file
  const commentCount = (path: string) =>
    (threads.get(path) ?? []).length;

  const filteredFiles = useMemo(() => {
    if (!diffResult) return [];
    if (!fileFilter) return diffResult.files;
    const q = fileFilter.toLowerCase();
    return diffResult.files.filter((f) =>
      f.file.path.toLowerCase().includes(q),
    );
  }, [diffResult, fileFilter]);

  const fileTree = useMemo(
    () => buildFileTree(filteredFiles),
    [filteredFiles],
  );

  const docTree = useMemo(() => buildPathTree(docFiles), [docFiles]);
  const designDocTree = useMemo(
    () => buildPathTree(designDocs),
    [designDocs],
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

  // Virtualized file tree
  const flatNodes = useMemo(
    () => flattenTree(fileTree, collapsedDirs),
    [fileTree, collapsedDirs],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "/") {
        e.preventDefault();
        filterInputRef.current?.focus();
        return;
      }

      if (flatNodes.length === 0) return;

      const currentIndex = focusedNodePath
        ? flatNodes.findIndex((n) => n.node.path === focusedNodePath)
        : -1;
      const currentNode = currentIndex >= 0 ? flatNodes[currentIndex] : null;

      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault();
          const next = Math.min(
            currentIndex < 0 ? 0 : currentIndex + 1,
            flatNodes.length - 1,
          );
          const nextNode = flatNodes[next];
          setFocusedNodePath(nextNode.node.path);
          if (!nextNode.node.isDir && nextNode.node.fileDiff) {
            setSelectedFile(nextNode.node.fileDiff.file.path);
          }
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          const prev = Math.max(currentIndex - 1, 0);
          const prevNode = flatNodes[prev];
          setFocusedNodePath(prevNode.node.path);
          if (!prevNode.node.isDir && prevNode.node.fileDiff) {
            setSelectedFile(prevNode.node.fileDiff.file.path);
          }
          break;
        }
        case "ArrowRight": {
          e.preventDefault();
          if (currentNode?.node.isDir && collapsedDirs.has(currentNode.node.path)) {
            toggleDir(currentNode.node.path);
          }
          break;
        }
        case "ArrowLeft": {
          e.preventDefault();
          if (currentNode?.node.isDir && !collapsedDirs.has(currentNode.node.path)) {
            toggleDir(currentNode.node.path);
          }
          break;
        }
        case "Enter": {
          e.preventDefault();
          if (currentNode?.node.isDir) {
            toggleDir(currentNode.node.path);
          } else if (currentNode?.node.fileDiff) {
            setSelectedFile(currentNode.node.fileDiff.file.path);
          }
          break;
        }
      }
    },
    [flatNodes, focusedNodePath, collapsedDirs, toggleDir, setSelectedFile],
  );

  const listContainerRef = useRef<HTMLDivElement>(null);
  const [listHeight, setListHeight] = useState(300);

  // Measure available height for virtual list
  useEffect(() => {
    const el = listContainerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect.height;
      if (h && h > 0) setListHeight(h);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const TreeRow = useCallback(
    ({ index, style: rowStyle }: RowComponentProps) => {
      const { node, depth } = flatNodes[index];

      if (node.isDir) {
        const isCollapsed = collapsedDirs.has(node.path);
        const isFocused = focusedNodePath === node.path;
        return (
          <li
            role="treeitem"
            aria-expanded={!isCollapsed}
            className={`file-item tree-dir${isFocused ? " focused" : ""}`}
            style={{ ...rowStyle, paddingLeft: `${depth * 12 + 12}px` }}
            onClick={() => toggleDir(node.path)}
          >
            <span className={s.treeToggle}>
              {isCollapsed ? "▶" : "▼"}
            </span>
            <span className={s.fileIcon}>
              {isCollapsed ? <FolderClosedIcon /> : <FolderOpenIcon />}
            </span>
            <span className={s.fileName}>{node.name}</span>
          </li>
        );
      }

      const fd = node.fileDiff!;
      const isGenCollapsed = collapsedFiles.has(fd.file.path);
      const isGenerated = fd.file.is_generated;
      const count = commentCount(fd.file.path);
      const isFocused = focusedNodePath === node.path;

      return (
        <li
          role="treeitem"
          aria-selected={selectedFile === fd.file.path}
          className={`file-item ${selectedFile === fd.file.path ? "selected" : ""} ${isGenerated ? "generated" : ""}${isFocused ? " focused" : ""}`}
          style={{ ...rowStyle, paddingLeft: `${depth * 12 + 12}px` }}
          onClick={() => {
            if (isGenerated && isGenCollapsed) {
              toggleFileCollapse(fd.file.path);
            }
            setSelectedFile(fd.file.path);
          }}
          title={fd.file.path}
        >
          <span
            className={s.fileStatus}
            style={{ color: getStatusColor(fd.file.status) }}
          >
            {getStatusLabel(fd.file.status)}
          </span>
          <span className={s.fileIcon}>{getFileIcon(node.name)}</span>
          <span className={s.fileName}>{node.name}</span>
          <span className={s.fileChanges}>
            {fd.file.additions > 0 && (
              <span className="stat-added">+{fd.file.additions}</span>
            )}
            {fd.file.deletions > 0 && (
              <span className="stat-deleted">-{fd.file.deletions}</span>
            )}
          </span>
          {count > 0 && <span className={s.commentBadge}>{count}</span>}
          {isTauri && (
            <button
              className={s.openInZed}
              onClick={(e) => {
                e.stopPropagation();
                api.openInZed(fd.file.path).catch((err) => console.error("Failed to open in Zed:", err));
              }}
              title="Open in Zed"
            >
              ↗
            </button>
          )}
          {isGenerated && (
            <button
              className={s.collapseBtn}
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
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [flatNodes, collapsedDirs, collapsedFiles, selectedFile, focusedNodePath, isTauri, threads],
  );

  const renderDocTreeNode = (node: FileTreeNode, depth: number) => {
    if (node.isDir) {
      const isCollapsed = collapsedDirs.has(node.path);
      return (
        <React.Fragment key={node.path}>
          <li
            role="treeitem"
            aria-expanded={!isCollapsed}
            className="file-item tree-dir"
            style={{ paddingLeft: `${depth * 12 + 12}px` }}
            onClick={() => toggleDir(node.path)}
          >
            <span className={s.treeToggle}>
              {isCollapsed ? "▶" : "▼"}
            </span>
            <span className={s.fileIcon}>
              {isCollapsed ? <FolderClosedIcon /> : <FolderOpenIcon />}
            </span>
            <span className={s.fileName}>{node.name}</span>
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
        role="treeitem"
        aria-selected={selectedDoc === node.path}
        className={`file-item ${selectedDoc === node.path ? "selected" : ""}`}
        style={{ paddingLeft: `${depth * 12 + 12}px` }}
        onClick={() => {
          setDocSource("repo");
          setSelectedDoc(node.path);
        }}
        title={node.path}
      >
        <span className={s.fileIcon}>{getFileIcon(node.name)}</span>
        <span className={s.fileName}>{node.name}</span>
      </li>
    );
  };

  const renderDesignDocTreeNode = (node: FileTreeNode, depth: number) => {
    if (node.isDir) {
      const isCollapsed = collapsedDirs.has(`design:${node.path}`);
      return (
        <React.Fragment key={`design:${node.path}`}>
          <li
            role="treeitem"
            aria-expanded={!isCollapsed}
            className="file-item tree-dir"
            style={{ paddingLeft: `${depth * 12 + 12}px` }}
            onClick={() => toggleDir(`design:${node.path}`)}
          >
            <span className={s.treeToggle}>
              {isCollapsed ? "▶" : "▼"}
            </span>
            <span className={s.fileIcon}>
              {isCollapsed ? <FolderClosedIcon /> : <FolderOpenIcon />}
            </span>
            <span className={s.fileName}>{node.name}</span>
          </li>
          {!isCollapsed &&
            node.children.map((child) =>
              renderDesignDocTreeNode(child, depth + 1),
            )}
        </React.Fragment>
      );
    }

    const docId = `design:${node.path}`;
    return (
      <li
        key={docId}
        role="treeitem"
        aria-selected={selectedDoc === docId}
        className={`file-item ${selectedDoc === docId ? "selected" : ""}`}
        style={{ paddingLeft: `${depth * 12 + 12}px` }}
        onClick={() => {
          setDocSource("design");
          setSelectedDoc(docId);
        }}
        title={node.path}
      >
        <span className={s.fileIcon}>📐</span>
        <span className={s.fileName}>{node.name}</span>
      </li>
    );
  };

  const renderExternalDocTreeNode = (folder: string, node: FileTreeNode, depth: number): React.ReactNode => {
    if (node.isDir) {
      const key = `ext:${folder}:${node.path}`;
      const isCollapsed = collapsedDirs.has(key);
      return (
        <React.Fragment key={key}>
          <li
            role="treeitem"
            aria-expanded={!isCollapsed}
            className="file-item tree-dir"
            style={{ paddingLeft: `${depth * 12 + 12}px` }}
            onClick={() => toggleDir(key)}
          >
            <span className={s.treeToggle}>
              {isCollapsed ? "▶" : "▼"}
            </span>
            <span className={s.fileIcon}>
              {isCollapsed ? <FolderClosedIcon /> : <FolderOpenIcon />}
            </span>
            <span className={s.fileName}>{node.name}</span>
          </li>
          {!isCollapsed &&
            node.children.map((child) =>
              renderExternalDocTreeNode(folder, child, depth + 1),
            )}
        </React.Fragment>
      );
    }

    const docId = `external:${folder}/${node.path}`;
    return (
      <li
        key={docId}
        role="treeitem"
        aria-selected={selectedDoc === docId}
        className={`file-item ${selectedDoc === docId ? "selected" : ""}`}
        style={{ paddingLeft: `${depth * 12 + 12}px` }}
        onClick={() => {
          setDocSource("external");
          setSelectedDoc(docId);
        }}
        title={`${folder}/${node.path}`}
      >
        <span className={s.fileIcon}>{getFileIcon(node.name)}</span>
        <span className={s.fileName}>{node.name}</span>
      </li>
    );
  };

  const externalDocTrees = useMemo(
    () =>
      Object.fromEntries(
        externalFolders.map((folder) => [
          folder,
          buildPathTree(externalDocs[folder] ?? []),
        ]),
      ),
    [externalFolders, externalDocs],
  );

  return (
    <aside className={s.sidebar} style={style} aria-label="File browser">
      {showDocFiles && (
        <div className={`${s.section} ${s.addFolderSection}`}>
          <button
            className={`${s.addFolderBtn} add-folder-btn`}
            onClick={handleAddFolder}
            title="Add a folder to browse"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M1.75 1A1.75 1.75 0 0 0 0 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0 0 16 13.25v-8.5A1.75 1.75 0 0 0 14.25 3H7.5a.25.25 0 0 1-.2-.1l-.9-1.2C6.07 1.26 5.55 1 5 1H1.75z" />
            </svg>
            Add Folder
          </button>
        </div>
      )}

      {showDocFiles && externalFolders.map((folder) => {
        const folderName = folder.split("/").pop() || folder;
        const sectionId = `external:${folder}`;
        const tree = externalDocTrees[folder] ?? [];
        return (
          <div
            key={sectionId}
            className={`${s.section} ${collapsedSections.has(sectionId) ? s.collapsed : ""}`}
          >
            <h3
              className={`${s.sectionTitle} ${s.sectionToggle} sidebar-section-title`}
              onClick={() => toggleSection(sectionId)}
            >
              <span className={s.chevron}>▼</span>
              {folderName}
              <button
                className={s.removeFolderBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  removeExternalFolder(folder);
                }}
                title="Remove folder"
              >
                &#x2715;
              </button>
            </h3>
            <div
              className={`${s.collapse} ${collapsedSections.has(sectionId) ? s.collapsed : ""}`}
            >
              <div className={s.collapseInner}>
                {tree.length === 0 ? (
                  <p className={s.emptyHint}>No .md files found</p>
                ) : (
                  <ul className={s.fileList} role="tree" aria-label={folderName}>
                    {tree.map((node) =>
                      renderExternalDocTreeNode(folder, node, 0),
                    )}
                  </ul>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {showDocFiles && docFiles.length > 0 && (
        <div
          className={`${s.section} ${collapsedSections.has("documents") ? s.collapsed : ""}`}
        >
          <h3
            className={`${s.sectionTitle} ${s.sectionToggle} sidebar-section-title`}
            onClick={() => toggleSection("documents")}
          >
            <span className={s.chevron}>▼</span>
            Documents
          </h3>
          <div
            className={`${s.collapse} ${collapsedSections.has("documents") ? s.collapsed : ""}`}
          >
            <div className={s.collapseInner}>
              <ul className={s.fileList} role="tree" aria-label="Documents">
                {docTree.map((node) => renderDocTreeNode(node, 0))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {showDocFiles && designDocs.length > 0 && (
        <div
          className={`${s.section} ${collapsedSections.has("design-docs") ? s.collapsed : ""}`}
        >
          <h3
            className={`${s.sectionTitle} ${s.sectionToggle} sidebar-section-title`}
            onClick={() => toggleSection("design-docs")}
          >
            <span className={s.chevron}>▼</span>
            Design Docs
          </h3>
          <div
            className={`${s.collapse} ${collapsedSections.has("design-docs") ? s.collapsed : ""}`}
          >
            <div className={s.collapseInner}>
              <ul className={s.fileList} role="tree" aria-label="Design docs">
                {designDocTree.map((node) =>
                  renderDesignDocTreeNode(node, 0),
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      {showDiffFiles && diffResult && (
        <div
          className={`${s.section} ${collapsedSections.has("changed-files") ? s.collapsed : ""}`}
        >
          <h3
            className={`${s.sectionTitle} ${s.sectionToggle} sidebar-section-title`}
            onClick={() => toggleSection("changed-files")}
          >
            <span className={s.chevron}>▼</span>
            Changed Files
            <span className="badge">
              {fileFilter
                ? `${filteredFiles.length}/${diffResult.stats.files_changed}`
                : diffResult.stats.files_changed}
            </span>
          </h3>
          <div
            className={`${s.collapse} ${collapsedSections.has("changed-files") ? s.collapsed : ""}`}
          >
            <div className={s.collapseInner}>
              <div className={s.filter}>
                <input
                  ref={filterInputRef}
                  type="text"
                  className={s.filterInput}
                  placeholder="Filter files\u2026"
                  value={fileFilter}
                  onChange={(e) => setFileFilter(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Filter changed files"
                />
                {fileFilter && (
                  <button
                    className={s.filterClear}
                    onClick={() => setFileFilter("")}
                    aria-label="Clear filter"
                  >
                    &#x2715;
                  </button>
                )}
              </div>
              <div className={s.sidebarStats}>
                <span className="stat-added">
                  +{diffResult.stats.additions}
                </span>
                <span className="stat-deleted">
                  -{diffResult.stats.deletions}
                </span>
              </div>
              <div
                ref={listContainerRef}
                className={s.virtualContainer}
                role="tree"
                aria-label="Changed files"
                tabIndex={0}
                onKeyDown={handleKeyDown}
              >
                <List
                  style={{ overflow: "auto" }}
                  rowComponent={TreeRow}
                  rowCount={flatNodes.length}
                  rowHeight={(index: number) =>
                    flatNodes[index].node.isDir ? DIR_ROW_HEIGHT : FILE_ROW_HEIGHT
                  }
                  rowProps={{}}
                  overscanCount={10}
                  defaultHeight={listHeight}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
