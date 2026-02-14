import React, { useEffect, useRef, useCallback, useState } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { WebglAddon } from "@xterm/addon-webgl";
import { SearchAddon } from "@xterm/addon-search";
import "@xterm/xterm/css/xterm.css";
import * as api from "../utils/tauri-api";

const isTauri = typeof window !== "undefined" && "__TAURI__" in window;
const isMac =
  typeof navigator !== "undefined" && navigator.platform.includes("Mac");

const DEFAULT_FONT_SIZE = 13;
const MIN_FONT_SIZE = 8;
const MAX_FONT_SIZE = 28;

export const TerminalPanel: React.FC<{ visible: boolean }> = ({ visible }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const spawnedRef = useRef(false);
  const unlistenDataRef = useRef<(() => void) | null>(null);
  const unlistenExitRef = useRef<(() => void) | null>(null);

  // Batch writing buffer: accumulate PTY data and flush once per animation frame
  const writeBufferRef = useRef<string[]>([]);
  const rafIdRef = useRef<number | null>(null);

  // Search bar state
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const flushWriteBuffer = useCallback(() => {
    rafIdRef.current = null;
    const term = termRef.current;
    const chunks = writeBufferRef.current;
    if (!term || chunks.length === 0) return;

    // Join all buffered chunks and write once
    const combined = chunks.join("");
    writeBufferRef.current = [];
    term.write(combined);
  }, []);

  const enqueueWrite = useCallback(
    (data: string) => {
      writeBufferRef.current.push(data);
      if (rafIdRef.current === null) {
        rafIdRef.current = requestAnimationFrame(flushWriteBuffer);
      }
    },
    [flushWriteBuffer],
  );

  // Search helpers
  const doSearch = useCallback(
    (query: string, direction: "next" | "prev" = "next") => {
      const addon = searchAddonRef.current;
      if (!addon || !query) return;
      if (direction === "next") {
        addon.findNext(query, { regex: false, incremental: true });
      } else {
        addon.findPrevious(query, { regex: false, incremental: true });
      }
    },
    [],
  );

  const closeSearch = useCallback(() => {
    setSearchVisible(false);
    setSearchQuery("");
    searchAddonRef.current?.clearDecorations();
    termRef.current?.focus();
  }, []);

  const initTerminal = useCallback(async () => {
    if (!containerRef.current || termRef.current) return;

    const term = new XTerm({
      theme: {
        background: "#0d1117",
        foreground: "#e6edf3",
        cursor: "#58a6ff",
        cursorAccent: "#0d1117",
        selectionBackground: "rgba(88, 166, 255, 0.3)",
        black: "#484f58",
        red: "#ff7b72",
        green: "#3fb950",
        yellow: "#d29922",
        blue: "#58a6ff",
        magenta: "#bc8cff",
        cyan: "#39c5cf",
        white: "#b1bac4",
        brightBlack: "#6e7681",
        brightRed: "#ffa198",
        brightGreen: "#56d364",
        brightYellow: "#e3b341",
        brightBlue: "#79c0ff",
        brightMagenta: "#d2a8ff",
        brightCyan: "#56d4dd",
        brightWhite: "#f0f6fc",
      },
      fontFamily:
        "SF Mono, Fira Code, Fira Mono, Roboto Mono, Menlo, Consolas, monospace",
      fontSize: DEFAULT_FONT_SIZE,
      lineHeight: 1.4,
      cursorBlink: true,
      allowProposedApi: true,
      scrollback: 10000,
      // Developer-friendly word separators: keeps -_./:\~@#= etc. as word chars
      // so double-click selects file paths, URLs, and snake_case/kebab-case names
      wordSeparator: " ()[]{}'\",;|&><`",
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    // Search addon
    const searchAddon = new SearchAddon();
    term.loadAddon(searchAddon);
    searchAddonRef.current = searchAddon;

    // URL click support — open in default browser via Tauri shell plugin
    const webLinksAddon = new WebLinksAddon(async (_event, url) => {
      try {
        if (isTauri) {
          const { open } = await import("@tauri-apps/plugin-shell");
          await open(url);
        } else {
          window.open(url, "_blank");
        }
      } catch {
        // Fallback: silently ignore if shell open fails
      }
    });
    term.loadAddon(webLinksAddon);

    term.open(containerRef.current);

    // WebGL GPU-accelerated renderer (fallback to canvas if WebGL unavailable)
    try {
      const webglAddon = new WebglAddon();
      webglAddon.onContextLoss(() => {
        webglAddon.dispose();
      });
      term.loadAddon(webglAddon);
    } catch {
      // WebGL not available — continue with default canvas renderer
    }

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    // Initial fit
    requestAnimationFrame(() => {
      fitAddon.fit();
    });

    // Key bindings
    term.attachCustomKeyEventHandler((e: KeyboardEvent) => {
      if (e.type !== "keydown") return true;

      // Copy: Cmd+C (Mac) or Ctrl+Shift+C (Linux/Win)
      const isCopy = isMac
        ? e.metaKey && e.key === "c"
        : e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "c";
      if (isCopy) {
        const selection = term.getSelection();
        if (selection) {
          api.copyToClipboard(selection).catch(() => {});
        }
        return false;
      }

      // Paste: Cmd+V (Mac) or Ctrl+Shift+V (Linux/Win)
      const isPaste = isMac
        ? e.metaKey && e.key === "v"
        : e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "v";
      if (isPaste) {
        api
          .readFromClipboard()
          .then((text) => {
            if (text) api.writeTerminal(text).catch(() => {});
          })
          .catch(() => {});
        return false;
      }

      // Search: Cmd+F (Mac) or Ctrl+Shift+F (Linux/Win)
      const isSearch = isMac
        ? e.metaKey && e.key === "f"
        : e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "f";
      if (isSearch) {
        setSearchVisible(true);
        requestAnimationFrame(() => searchInputRef.current?.focus());
        return false;
      }

      // Close search: Escape
      if (e.key === "Escape" && searchVisible) {
        closeSearch();
        return false;
      }

      // Clear terminal: Cmd+K (Mac) or Ctrl+Shift+K (Linux/Win)
      const isClear = isMac
        ? e.metaKey && e.key === "k"
        : e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "k";
      if (isClear) {
        term.clear();
        return false;
      }

      // Font size increase: Cmd+= (Mac) or Ctrl+= (Linux/Win)
      if ((isMac ? e.metaKey : e.ctrlKey) && (e.key === "=" || e.key === "+")) {
        const next = Math.min(term.options.fontSize! + 1, MAX_FONT_SIZE);
        term.options.fontSize = next;
        fitAddonRef.current?.fit();
        return false;
      }

      // Font size decrease: Cmd+- (Mac) or Ctrl+- (Linux/Win)
      if ((isMac ? e.metaKey : e.ctrlKey) && e.key === "-") {
        const next = Math.max(term.options.fontSize! - 1, MIN_FONT_SIZE);
        term.options.fontSize = next;
        fitAddonRef.current?.fit();
        return false;
      }

      // Font size reset: Cmd+0 (Mac) or Ctrl+0 (Linux/Win)
      if ((isMac ? e.metaKey : e.ctrlKey) && e.key === "0") {
        term.options.fontSize = DEFAULT_FONT_SIZE;
        fitAddonRef.current?.fit();
        return false;
      }

      return true;
    });

    // Send user input to PTY backend
    term.onData((data) => {
      api.writeTerminal(data).catch(() => {});
    });

    // Listen for PTY output with batched writing
    if (isTauri) {
      const { listen } = await import("@tauri-apps/api/event");

      const unData = await listen<string>("pty-data", (event) => {
        enqueueWrite(event.payload);
      });
      unlistenDataRef.current = unData;

      const unExit = await listen("pty-exit", () => {
        term.writeln("\r\n\x1b[90m[Process exited]\x1b[0m");
        spawnedRef.current = false;
      });
      unlistenExitRef.current = unExit;
    }

    // Spawn PTY
    if (!spawnedRef.current) {
      try {
        await api.spawnTerminal(term.cols, term.rows);
        spawnedRef.current = true;
      } catch (err) {
        term.writeln(
          `\x1b[31mFailed to spawn terminal: ${err}\x1b[0m`,
        );
      }
    }

    // Handle resize
    term.onResize(({ cols, rows }) => {
      if (spawnedRef.current) {
        api.resizeTerminal(cols, rows).catch(() => {});
      }
    });
  }, [enqueueWrite, closeSearch]);

  // Initialize terminal when first made visible
  useEffect(() => {
    if (visible && !termRef.current) {
      initTerminal();
    }
  }, [visible, initTerminal]);

  // Re-fit when visibility changes
  useEffect(() => {
    if (visible && fitAddonRef.current && termRef.current) {
      requestAnimationFrame(() => {
        fitAddonRef.current?.fit();
      });
      termRef.current.focus();
    }
  }, [visible]);

  // ResizeObserver to handle container size changes
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver(() => {
      if (visible && fitAddonRef.current) {
        fitAddonRef.current.fit();
      }
    });
    observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, [visible]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
      unlistenDataRef.current?.();
      unlistenExitRef.current?.();
      termRef.current?.dispose();
    };
  }, []);

  return (
    <div
      className={`terminal-container ${visible ? "" : "terminal-hidden"}`}
      ref={containerRef}
    >
      {searchVisible && (
        <div className="terminal-search-bar">
          <input
            ref={searchInputRef}
            type="text"
            className="terminal-search-input"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              doSearch(e.target.value, "next");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                doSearch(searchQuery, e.shiftKey ? "prev" : "next");
              }
              if (e.key === "Escape") {
                closeSearch();
              }
            }}
          />
          <button
            className="terminal-search-btn"
            title="Previous (Shift+Enter)"
            onClick={() => doSearch(searchQuery, "prev")}
          >
            &#x25B2;
          </button>
          <button
            className="terminal-search-btn"
            title="Next (Enter)"
            onClick={() => doSearch(searchQuery, "next")}
          >
            &#x25BC;
          </button>
          <button
            className="terminal-search-btn terminal-search-close"
            title="Close (Escape)"
            onClick={closeSearch}
          >
            &#x2715;
          </button>
        </div>
      )}
    </div>
  );
};
