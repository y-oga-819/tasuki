import { useEffect } from "react";
import { useStore } from "../store";
import * as api from "../utils/tauri-api";

const isTauri = typeof window !== "undefined" && "__TAURI__" in window;

/** Listen for file change events from the Rust backend */
export function useFileWatcher(onFilesChanged: () => void) {
  useEffect(() => {
    if (!isTauri) return;

    let unlisten: (() => void) | undefined;

    (async () => {
      try {
        await api.startWatching();
        const { listen } = await import("@tauri-apps/api/event");
        unlisten = await listen<string[]>("files-changed", () => {
          onFilesChanged();
        });
      } catch (err) {
        console.error("Failed to start file watcher:", err);
      }
    })();

    return () => {
      unlisten?.();
    };
  }, [onFilesChanged]);
}
