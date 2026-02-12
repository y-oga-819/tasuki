import React, { useEffect, useRef, useCallback } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";
import * as api from "../utils/tauri-api";

const isTauri = typeof window !== "undefined" && "__TAURI__" in window;

export const TerminalPanel: React.FC<{ visible: boolean }> = ({ visible }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const spawnedRef = useRef(false);
  const unlistenDataRef = useRef<(() => void) | null>(null);
  const unlistenExitRef = useRef<(() => void) | null>(null);

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
      fontSize: 13,
      lineHeight: 1.4,
      cursorBlink: true,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

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

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    // Initial fit
    requestAnimationFrame(() => {
      fitAddon.fit();
    });

    // Send user input to PTY backend
    term.onData((data) => {
      api.writeTerminal(data).catch(() => {});
    });

    // Listen for PTY output
    if (isTauri) {
      const { listen } = await import("@tauri-apps/api/event");

      const unData = await listen<string>("pty-data", (event) => {
        term.write(event.payload);
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
  }, []);

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
      unlistenDataRef.current?.();
      unlistenExitRef.current?.();
      termRef.current?.dispose();
    };
  }, []);

  return (
    <div
      className={`terminal-container ${visible ? "" : "terminal-hidden"}`}
      ref={containerRef}
    />
  );
};
