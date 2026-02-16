import { useEffect } from "react";

import * as api from "../utils/tauri-api";

const isTauri = typeof window !== "undefined" && "__TAURI__" in window;

/** Listen for file change events from the Rust backend */
export function useFileWatcher(onFilesChanged: () => void, debounceMs = 300) {
  useEffect(() => {
    if (!isTauri) return;

    let unlisten: (() => void) | undefined;
    let timerId: number | undefined;

    (async () => {
      try {
        await api.startWatching();
        const { listen } = await import("@tauri-apps/api/event");
        unlisten = await listen<string[]>("files-changed", () => {
          if (timerId !== undefined) {
            window.clearTimeout(timerId);
          }
          timerId = window.setTimeout(() => {
            timerId = undefined;
            onFilesChanged();
          }, debounceMs);
        });
      } catch (err) {
        console.error("Failed to start file watcher:", err);
      }
    })();

    return () => {
      if (timerId !== undefined) {
        window.clearTimeout(timerId);
      }
      unlisten?.();
    };
  }, [onFilesChanged, debounceMs]);
}
