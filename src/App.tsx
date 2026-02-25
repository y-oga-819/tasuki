import React, { useEffect, useCallback, useRef, useState } from "react";
import { WorkerPoolContextProvider } from "@pierre/diffs/react";
import { Toolbar } from "./components/Toolbar";
import { FileSidebar } from "./components/FileSidebar";
import { MainContent } from "./components/MainContent";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ReviewPanel } from "./components/ReviewPanel";
import { useDisplayStore } from "./store/displayStore";
import { useDiffStore } from "./store/diffStore";
import { useReviewStore } from "./store/reviewStore";
import { useDiff } from "./hooks/useDiff";
import { useFileWatcher } from "./hooks/useFileWatcher";
import { useReviewPersistence } from "./hooks/useReviewPersistence";
import * as api from "./utils/tauri-api";

const isTauri = typeof window !== "undefined" && "__TAURI__" in window;

const DEFAULT_SIDEBAR_WIDTH = 260;
const MIN_SIDEBAR_WIDTH = 160;
const MAX_SIDEBAR_WIDTH = 500;

const App: React.FC = () => {
  const { displayMode } = useDisplayStore();
  const { setRepoPath, setRepoInfo, setDocFiles, setDesignDocs, setSelectedDoc } = useDiffStore();
  const { gateStatus, setGateStatus, setVerdict } = useReviewStore();
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
      const { ask } = await import("@tauri-apps/plugin-dialog");
      const appWindow = getCurrentWindow();
      unlisten = await appWindow.onCloseRequested(async (event) => {
        try {
          const alive = await api.isTerminalAlive();
          if (alive) {
            const confirmed = await ask(
              "ターミナルセッションが実行中です。終了しますか？",
              { title: "Tasuki", kind: "warning" },
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

  // Watch for file changes and refetch diff + invalidate gate
  const handleFilesChanged = useCallback(async () => {
    refetch();

    // If gate was approved/rejected, invalidate it since files changed
    if (gateStatus === "approved" || gateStatus === "rejected") {
      try {
        await api.clearCommitGate();
      } catch { /* ignore */ }
      setGateStatus("invalidated");
      setVerdict(null);
    }
  }, [refetch, gateStatus, setGateStatus, setVerdict]);

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
      <ErrorBoundary>
        <div className="app">
          <Toolbar />
          <div className="app-body">
            <FileSidebar style={{ width: sidebarWidth }} />
            <div
              className="sidebar-resize-handle"
              onPointerDown={handleSidebarPointerDown}
              onPointerMove={handleSidebarPointerMove}
              onPointerUp={handleSidebarPointerUp}
            />
            <MainContent />
          </div>
          {displayMode !== "terminal" && <ReviewPanel />}
        </div>
      </ErrorBoundary>
    </WorkerPoolContextProvider>
  );
};

export default App;
