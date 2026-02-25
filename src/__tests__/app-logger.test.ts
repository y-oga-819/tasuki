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

  it("keeps exactly MAX_ENTRIES (100) when cap is reached", () => {
    for (let i = 0; i < 101; i++) {
      appLogger.warn("test", `msg ${i}`);
    }
    const entries = appLogger.getEntries();
    expect(entries).toHaveLength(100);
    // Oldest entry should be trimmed; entries[0] should be "msg 1"
    expect(entries[0].message).toBe("msg 1");
    expect(entries[99].message).toBe("msg 100");
  });

  it("supports multiple subscribers independently", () => {
    const handler1 = vi.fn<(entry: LogEntry) => void>();
    const handler2 = vi.fn<(entry: LogEntry) => void>();
    const unsub1 = appLogger.subscribe(handler1);
    const unsub2 = appLogger.subscribe(handler2);

    appLogger.warn("test", "hello");
    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);

    unsub1();
    appLogger.warn("test", "world");
    expect(handler1).toHaveBeenCalledTimes(1); // No additional call
    expect(handler2).toHaveBeenCalledTimes(2); // Still receiving

    unsub2();
  });

  it("includes timestamp in log entries", () => {
    const before = Date.now();
    appLogger.error("ctx", "msg");
    const after = Date.now();
    const entry = appLogger.getEntries()[0];
    expect(entry.timestamp).toBeGreaterThanOrEqual(before);
    expect(entry.timestamp).toBeLessThanOrEqual(after);
  });

  it("stores error as undefined when not provided", () => {
    appLogger.warn("test", "no error");
    const entry = appLogger.getEntries()[0];
    expect(entry.error).toBeUndefined();
  });

  it("mirrors to console.warn for warn level", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    appLogger.warn("ctx", "test message");
    expect(spy).toHaveBeenCalledWith("[ctx] test message", "");
    spy.mockRestore();
  });

  it("mirrors to console.error for error level", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const err = new Error("boom");
    appLogger.error("ctx", "test message", err);
    expect(spy).toHaveBeenCalledWith("[ctx] test message", err);
    spy.mockRestore();
  });
});
