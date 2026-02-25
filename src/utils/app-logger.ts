/**
 * Unified application logger.
 *
 * Provides a central place for non-fatal warnings and errors that occur in
 * hooks and background operations (file watcher, review persistence, etc.).
 * Entries are buffered in memory and can be subscribed to for UI display.
 */

export interface LogEntry {
  level: "warn" | "error";
  context: string;
  message: string;
  error?: unknown;
  timestamp: number;
}

type Subscriber = (entry: LogEntry) => void;

const MAX_ENTRIES = 100;

class AppLogger {
  private entries: LogEntry[] = [];
  private subscribers = new Set<Subscriber>();

  warn(context: string, message: string, error?: unknown): void {
    this.add({ level: "warn", context, message, error, timestamp: Date.now() });
  }

  error(context: string, message: string, error?: unknown): void {
    this.add({ level: "error", context, message, error, timestamp: Date.now() });
  }

  getEntries(): ReadonlyArray<LogEntry> {
    return this.entries;
  }

  subscribe(fn: Subscriber): () => void {
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }

  clear(): void {
    this.entries = [];
  }

  private add(entry: LogEntry): void {
    this.entries.push(entry);
    if (this.entries.length > MAX_ENTRIES) {
      this.entries = this.entries.slice(-MAX_ENTRIES);
    }
    for (const fn of this.subscribers) {
      fn(entry);
    }
    // Mirror to console for development visibility
    if (entry.level === "error") {
      console.error(`[${entry.context}] ${entry.message}`, entry.error ?? "");
    } else {
      console.warn(`[${entry.context}] ${entry.message}`, entry.error ?? "");
    }
  }
}

export const appLogger = new AppLogger();
