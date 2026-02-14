import React, { useEffect, useCallback, useRef, useState } from "react";
import { WorkerPoolContextProvider } from "@pierre/diffs/react";
import { Toolbar } from "./components/Toolbar";
import { FileSidebar } from "./components/FileSidebar";
import { MainContent } from "./components/MainContent";
import { ReviewPanel } from "./components/ReviewPanel";
import { useStore } from "./store";
import { useDiff } from "./hooks/useDiff";
import { useFileWatcher } from "./hooks/useFileWatcher";
import { useReviewPersistence } from "./hooks/useReviewPersistence";
import * as api from "./utils/tauri-api";

const isTauri = typeof window !== "undefined" && "__TAURI__" in window;

const DEFAULT_SIDEBAR_WIDTH = 260;
const MIN_SIDEBAR_WIDTH = 160;
const MAX_SIDEBAR_WIDTH = 500;

const App: React.FC = () => {
  const { displayMode, setRepoPath, setRepoInfo, setDocFiles, setDesignDocs, setSelectedDoc } =
    useStore();
  const { refetch } = useDiff();

  // Sidebar resize
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const draggingRef = useRef(false);
  const rafIdRef = useRef(0);

  const handleSidebarPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    draggingRef.current = true;
    document.body.style.userSelect = "none";
  }, []);

  const handleSidebarPointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    const { clientX } = e;
    cancelAnimationFrame(rafIdRef.current);
    rafIdRef.current = requestAnimationFrame(() => {
      setSidebarWidth(
        Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, clientX)),
      );
    });
  }, []);

  const handleSidebarPointerUp = useCallback(() => {
    draggingRef.current = false;
    document.body.style.userSelect = "";
    cancelAnimationFrame(rafIdRef.current);
  }, []);

  useEffect(() => {
    return () => cancelAnimationFrame(rafIdRef.current);
  }, []);

  // Persist and restore review comments
  useReviewPersistence();

  // Initialize: get repo path and doc files
  useEffect(() => {
    (async () => {
      try {
        const path = await api.getRepoPath();
        setRepoPath(path);
      } catch {
        // Running outside Tauri, use placeholder
        setRepoPath(window.location.pathname || "/");
      }

      try {
        const info = await api.getRepoInfo();
        setRepoInfo(info);
      } catch {
        // May fail outside Tauri
      }

      try {
        const docs = await api.listDocs();
        setDocFiles(docs);
        if (docs.length > 0) {
          setSelectedDoc(docs[0]);
        }
      } catch {
        // Doc listing may fail outside Tauri
      }

      try {
        const designDocs = await api.listDesignDocs();
        setDesignDocs(designDocs);
      } catch {
        // May fail outside Tauri
      }
    })();
  }, [setRepoPath, setRepoInfo, setDocFiles, setDesignDocs, setSelectedDoc]);

  // Warn before closing if a terminal session is running
  useEffect(() => {
    if (!isTauri) return;

    let unlisten: (() => void) | undefined;
    (async () => {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const appWindow = getCurrentWindow();
      unlisten = await appWindow.onCloseRequested(async (event) => {
        try {
          const alive = await api.isTerminalAlive();
          if (alive) {
            const confirmed = window.confirm(
              "ターミナルセッションが実行中です。終了しますか？",
            );
            if (!confirmed) {
              event.preventDefault();
              return;
            }
            await api.killTerminal();
          }
        } catch {
          // If the check fails, allow closing
        }
      });
    })();

    return () => unlisten?.();
  }, []);

  // Watch for file changes and refetch diff
  const handleFilesChanged = useCallback(() => {
    refetch();
  }, [refetch]);

  useFileWatcher(handleFilesChanged);

  return (
    <WorkerPoolContextProvider
      poolOptions={{
        workerFactory: () =>
          new Worker(
            new URL("@pierre/diffs/worker/worker.js", import.meta.url),
            { type: "module" },
          ),
      }}
      highlighterOptions={{
        theme: { dark: "github-dark", light: "github-light" },
      }}
    >
      <div className="app">
        <Toolbar />
        <div className="app-body">
          {displayMode !== "terminal" && (
            <>
              <FileSidebar style={{ width: sidebarWidth }} />
              <div
                className="sidebar-resize-handle"
                onPointerDown={handleSidebarPointerDown}
                onPointerMove={handleSidebarPointerMove}
                onPointerUp={handleSidebarPointerUp}
              />
            </>
          )}
          <MainContent />
        </div>
        {displayMode !== "terminal" && <ReviewPanel />}
      </div>
    </WorkerPoolContextProvider>
  );
};

export default App;
