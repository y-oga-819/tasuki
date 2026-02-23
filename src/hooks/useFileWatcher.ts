import { useEffect } from "react";

import * as api from "../utils/tauri-api";
import { eventBus } from "../utils/tauri-events";
import { appLogger } from "../utils/app-logger";

/** Listen for file change events from the Rust backend */
export function useFileWatcher(onFilesChanged: () => void, debounceMs = 400) {
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let timerId: number | undefined;

    (async () => {
      try {
        await api.startWatching();
        unlisten = await eventBus.listen<string[]>("files-changed", () => {
          if (timerId !== undefined) {
            window.clearTimeout(timerId);
          }
          timerId = window.setTimeout(() => {
            timerId = undefined;
            onFilesChanged();
          }, debounceMs);
        });
      } catch (err) {
        appLogger.warn("file-watcher", "Failed to start file watcher", err);
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
