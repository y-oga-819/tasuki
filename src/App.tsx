import React, { useEffect, useCallback } from "react";
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

const App: React.FC = () => {
  const { setRepoPath, setRepoInfo, setDocFiles, setSelectedDoc } = useStore();
  const { refetch } = useDiff();

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
    })();
  }, [setRepoPath, setRepoInfo, setDocFiles, setSelectedDoc]);

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
          <FileSidebar />
          <MainContent />
        </div>
        <ReviewPanel />
      </div>
    </WorkerPoolContextProvider>
  );
};

export default App;
