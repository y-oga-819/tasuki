import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { SearchAddon } from "@xterm/addon-search";
import { WebglAddon } from "@xterm/addon-webgl";
import { Unicode11Addon } from "@xterm/addon-unicode11";
import * as api from "../utils/tauri-api";

const isTauri = typeof window !== "undefined" && "__TAURI__" in window;
const isMac =
  typeof navigator !== "undefined" && navigator.platform.includes("Mac");

const DEFAULT_FONT_SIZE = 13;
const MIN_FONT_SIZE = 8;
const MAX_FONT_SIZE = 28;

/**
 * Manages the XTerm.js instance lifecycle independently of React.
 * Survives layout switches (split ↔ viewer) by reparenting a persistent wrapper element.
 */
export class TerminalManager {
  private term: XTerm | null = null;
  private wrapper: HTMLDivElement | null = null;
  private fitAddon: FitAddon | null = null;
  private searchAddon: SearchAddon | null = null;
  private spawned = false;
  private unlistenData: (() => void) | null = null;
  private unlistenExit: (() => void) | null = null;
  private writeBuffer: string[] = [];
  private rafId: number | null = null;

  /** Callbacks for React-managed search UI */
  private _onSearchToggle: ((visible: boolean) => void) | null = null;
  private searchVisibleRef = { current: false };

  /** Set the search toggle callback (called from React effect) */
  setOnSearchToggle(cb: ((visible: boolean) => void) | null): void {
    this._onSearchToggle = cb;
  }

  get isInitialized(): boolean {
    return this.term !== null;
  }

  /**
   * Attach the terminal to a parent element.
   * If the terminal already exists, it's reparented; otherwise created fresh.
   */
  async init(parent: HTMLElement): Promise<void> {
    if (this.wrapper && this.term) {
      // Re-attach existing terminal to new parent
      parent.appendChild(this.wrapper);
      await document.fonts.ready;
      requestAnimationFrame(() => {
        this.fitAddon?.fit();
        this.term?.focus();
      });
      return;
    }

    // Create persistent wrapper div
    this.wrapper = document.createElement("div");
    this.wrapper.style.width = "100%";
    this.wrapper.style.height = "100%";
    parent.appendChild(this.wrapper);

    // Read terminal colors from CSS custom properties
    const cs = getComputedStyle(document.documentElement);
    const v = (name: string) => cs.getPropertyValue(name).trim();

    const term = new XTerm({
      theme: {
        background: v("--term-bg") || "#0d1117",
        foreground: v("--term-fg") || "#e6edf3",
        cursor: v("--term-cursor") || "#58a6ff",
        cursorAccent: v("--term-cursor-accent") || "#0d1117",
        selectionBackground: v("--term-selection") || "rgba(88, 166, 255, 0.3)",
        black: v("--term-black") || "#484f58",
        red: v("--term-red") || "#ff7b72",
        green: v("--term-green") || "#3fb950",
        yellow: v("--term-yellow") || "#d29922",
        blue: v("--term-blue") || "#58a6ff",
        magenta: v("--term-magenta") || "#bc8cff",
        cyan: v("--term-cyan") || "#39c5cf",
        white: v("--term-white") || "#b1bac4",
        brightBlack: v("--term-bright-black") || "#6e7681",
        brightRed: v("--term-bright-red") || "#ffa198",
        brightGreen: v("--term-bright-green") || "#56d364",
        brightYellow: v("--term-bright-yellow") || "#e3b341",
        brightBlue: v("--term-bright-blue") || "#79c0ff",
        brightMagenta: v("--term-bright-magenta") || "#d2a8ff",
        brightCyan: v("--term-bright-cyan") || "#56d4dd",
        brightWhite: v("--term-bright-white") || "#f0f6fc",
      },
      fontFamily:
        "SF Mono, Fira Code, Fira Mono, Roboto Mono, Menlo, Consolas, monospace",
      fontSize: DEFAULT_FONT_SIZE,
      lineHeight: 1.4,
      cursorBlink: true,
      allowProposedApi: true,
      scrollback: 10000,
      wordSeparator: " ()[]{}'\",;|&><`",
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    const unicode11Addon = new Unicode11Addon();
    term.loadAddon(unicode11Addon);
    term.unicode.activeVersion = "11";

    const searchAddon = new SearchAddon();
    term.loadAddon(searchAddon);

    const webLinksAddon = new WebLinksAddon(async (_event, url) => {
      try {
        if (isTauri) {
          const { open } = await import("@tauri-apps/plugin-shell");
          await open(url);
        } else {
          window.open(url, "_blank");
        }
      } catch { /* ignore */ }
    });
    term.loadAddon(webLinksAddon);

    term.open(this.wrapper);

    // WebGL renderer
    try {
      const webglAddon = new WebglAddon();
      webglAddon.onContextLoss(() => webglAddon.dispose());
      term.loadAddon(webglAddon);
    } catch { /* WebGL not available */ }

    this.term = term;
    this.fitAddon = fitAddon;
    this.searchAddon = searchAddon;

    // Key bindings
    term.attachCustomKeyEventHandler((e: KeyboardEvent) => {
      if (e.type !== "keydown") return true;

      const isCopy = isMac
        ? e.metaKey && e.key === "c"
        : e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "c";
      if (isCopy) {
        const selection = term.getSelection();
        if (selection) api.copyToClipboard(selection).catch(() => {});
        return false;
      }

      const isPaste = isMac
        ? e.metaKey && e.key === "v"
        : e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "v";
      if (isPaste) {
        e.preventDefault();
        api.readFromClipboard().then((text) => {
          if (text) api.writeTerminal(text).catch(() => {});
        }).catch(() => {});
        return false;
      }

      const isSearch = isMac
        ? e.metaKey && e.key === "f"
        : e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "f";
      if (isSearch) {
        this._onSearchToggle?.(true);
        return false;
      }

      if (e.key === "Escape" && this.searchVisibleRef.current) {
        this.closeSearch();
        return false;
      }

      const isClear = isMac
        ? e.metaKey && e.key === "k"
        : e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "k";
      if (isClear) {
        term.clear();
        return false;
      }

      if ((isMac ? e.metaKey : e.ctrlKey) && (e.key === "=" || e.key === "+")) {
        term.options.fontSize = Math.min(term.options.fontSize! + 1, MAX_FONT_SIZE);
        fitAddon.fit();
        return false;
      }

      if ((isMac ? e.metaKey : e.ctrlKey) && e.key === "-") {
        term.options.fontSize = Math.max(term.options.fontSize! - 1, MIN_FONT_SIZE);
        fitAddon.fit();
        return false;
      }

      if ((isMac ? e.metaKey : e.ctrlKey) && e.key === "0") {
        term.options.fontSize = DEFAULT_FONT_SIZE;
        fitAddon.fit();
        return false;
      }

      return true;
    });

    // Send user input to PTY
    term.onData((data) => {
      api.writeTerminal(data).catch(() => {});
    });

    // Listen for PTY output
    if (isTauri) {
      const { listen } = await import("@tauri-apps/api/event");

      this.unlistenData = await listen<string>("pty-data", (event) => {
        this.enqueueWrite(event.payload);
      });

      this.unlistenExit = await listen("pty-exit", () => {
        term.writeln("\r\n\x1b[90m[Process exited]\x1b[0m");
        this.spawned = false;
        api.killTerminal().catch(() => {});
      });
    }

    // Handle resize
    term.onResize(({ cols, rows }) => {
      if (this.spawned) {
        api.resizeTerminal(cols, rows).catch(() => {});
      }
    });

    // Fit and spawn
    await document.fonts.ready;
    requestAnimationFrame(async () => {
      fitAddon.fit();
      if (!this.spawned) {
        try {
          await api.spawnTerminal(term.cols, term.rows);
          this.spawned = true;
        } catch (err) {
          term.writeln(`\x1b[31mFailed to spawn terminal: ${err}\x1b[0m`);
        }
      }
    });
  }

  /** Remove from parent without disposing the terminal */
  detach(): void {
    this.wrapper?.remove();
  }

  /** Fit terminal to container */
  fit(): void {
    this.fitAddon?.fit();
  }

  /** Focus the terminal */
  focus(): void {
    this.term?.focus();
  }

  /** Set search visibility ref for key handler */
  setSearchVisible(visible: boolean): void {
    this.searchVisibleRef.current = visible;
  }

  /** Search methods */
  findNext(query: string): void {
    this.searchAddon?.findNext(query, { regex: false, incremental: true });
  }

  findPrev(query: string): void {
    this.searchAddon?.findPrevious(query, { regex: false, incremental: true });
  }

  closeSearch(): void {
    this.searchAddon?.clearDecorations();
    this._onSearchToggle?.(false);
    this.term?.focus();
  }

  /** Clean up everything */
  dispose(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.unlistenData?.();
    this.unlistenExit?.();
    this.term?.dispose();
    this.term = null;
    this.wrapper?.remove();
    this.wrapper = null;
  }

  // --- Write buffering ---
  private enqueueWrite(data: string): void {
    this.writeBuffer.push(data);
    if (this.rafId === null) {
      this.rafId = requestAnimationFrame(() => this.flushWriteBuffer());
    }
  }

  private flushWriteBuffer(): void {
    this.rafId = null;
    if (!this.term || this.writeBuffer.length === 0) return;
    const combined = this.writeBuffer.join("");
    this.writeBuffer = [];
    this.term.write(combined);
  }
}
