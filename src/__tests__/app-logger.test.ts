import { describe, it, expect, vi, beforeEach } from "vitest";
import { appLogger, type LogEntry } from "../utils/app-logger";

beforeEach(() => {
  appLogger.clear();
});

describe("appLogger", () => {
  it("logs a warning with context", () => {
    appLogger.warn("file-watcher", "Failed to start watcher");
    const entries = appLogger.getEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].level).toBe("warn");
    expect(entries[0].context).toBe("file-watcher");
    expect(entries[0].message).toBe("Failed to start watcher");
  });

  it("logs an error with an Error object", () => {
    const err = new Error("Network failure");
    appLogger.error("persistence", "Failed to save review", err);
    const entries = appLogger.getEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].level).toBe("error");
    expect(entries[0].error).toBe(err);
  });

  it("caps entries at maxEntries", () => {
    for (let i = 0; i < 150; i++) {
      appLogger.warn("test", `msg ${i}`);
    }
    expect(appLogger.getEntries().length).toBeLessThanOrEqual(100);
  });

  it("calls subscribers on new entries", () => {
    const handler = vi.fn<(entry: LogEntry) => void>();
    const unsub = appLogger.subscribe(handler);

    appLogger.warn("test", "hello");
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ message: "hello" }),
    );

    unsub();
    appLogger.warn("test", "world");
    expect(handler).toHaveBeenCalledTimes(1); // No additional call after unsub
  });

  it("clear removes all entries", () => {
    appLogger.warn("test", "msg");
    appLogger.clear();
    expect(appLogger.getEntries()).toHaveLength(0);
  });
});
