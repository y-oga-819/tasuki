import React, { useEffect, useRef, useState } from "react";
import { useDiffStore } from "../store/diffStore";
import { DiffViewer } from "./DiffViewer";
import { DiffSearchBar } from "./DiffSearchBar";
import { ErrorBoundary } from "./ErrorBoundary";

const isMac =
  typeof navigator !== "undefined" && navigator.platform.includes("Mac");

/** Render all file diffs, scrolling to selectedFile on change */
const AllFileDiffs: React.FC = () => {
  const { diffResult, selectedFile, collapsedFiles, toggleFileCollapse } =
    useDiffStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const prevFileRef = useRef<string | null>(null);

  // selectedFile変更時のみ実行。collapsedFiles/toggleFileCollapseは
  // 意図的に依存配列から除外（折りたたみ操作でのスクロール発火を防止）
  /* eslint-disable react-hooks/exhaustive-deps */
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
  /* eslint-enable react-hooks/exhaustive-deps */

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

/** Diff content wrapped with a find-in-diff search bar (Cmd+F) */
export const DiffPane: React.FC = () => {
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
