import React, { useEffect, useCallback, useRef, useState } from "react";
import { WorkerPoolContextProvider } from "@pierre/diffs/react";
import { Toolbar } from "./components/Toolbar";
import { FileSidebar } from "./components/FileSidebar";
import { MainContent } from "./components/MainContent";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { StaleBanner } from "./components/StaleBanner";
import { useDiffStore } from "./store/diffStore";
import { useDocStore } from "./store/docStore";
import { useDiff } from "./hooks/useDiff";
import { useFileWatcher } from "./hooks/useFileWatcher";
import { useReviewPersistence } from "./hooks/useReviewPersistence";
import { TerminalManagerProvider } from "./components/TerminalManagerContext";
import * as api from "./utils/tauri-api";

const isTauri = typeof window !== "undefined" && "__TAURI__" in window;

const DEFAULT_SIDEBAR_WIDTH = 260;
const MIN_SIDEBAR_WIDTH = 160;
const MAX_SIDEBAR_WIDTH = 500;

const App: React.FC = () => {
  const { setRepoPath, setRepoInfo } = useDiffStore();
  const { setDocFiles, setDesignDocs, setSelectedDoc } = useDocStore();
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

  const handleSidebarKeyDown = useCallback((e: React.KeyboardEvent) => {
    const step = 20; // px per key press
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      setSidebarWidth((prev) => Math.max(MIN_SIDEBAR_WIDTH, prev - step));
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      setSidebarWidth((prev) => Math.min(MAX_SIDEBAR_WIDTH, prev + step));
    }
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

  // Watch for file changes (HEAD SHA detection + stale banner + focus auto-refresh)
  useFileWatcher(refetch);

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
      <TerminalManagerProvider>
      <ErrorBoundary>
        <div className="app">
          <Toolbar />
          <StaleBanner onRefresh={refetch} />
          <div className="app-body">
            <FileSidebar style={{ width: sidebarWidth }} />
            <div
              className="sidebar-resize-handle"
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize sidebar"
              aria-valuenow={Math.round(sidebarWidth)}
              aria-valuemin={MIN_SIDEBAR_WIDTH}
              aria-valuemax={MAX_SIDEBAR_WIDTH}
              tabIndex={0}
              onPointerDown={handleSidebarPointerDown}
              onPointerMove={handleSidebarPointerMove}
              onPointerUp={handleSidebarPointerUp}
              onKeyDown={handleSidebarKeyDown}
            />
            <MainContent />
          </div>
        </div>
      </ErrorBoundary>
      </TerminalManagerProvider>
    </WorkerPoolContextProvider>
  );
};

export default App;
